import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useMedia, useSessionStorage } from 'react-use';

import { GrafanaTheme2, PanelData } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { Button, Field, FilterInput, ScrollContainer, Stack, Tab, TabContent, TabsBar, useStyles2, useTheme2 } from '@grafana/ui';
import { LS_VISUALIZATION_SELECT_TAB_KEY } from 'app/core/constants';
import { VisualizationSelectPaneTab } from 'app/features/dashboard/components/PanelEditor/types';
import { VisualizationSuggestions } from 'app/features/panel/components/VizTypePicker/VisualizationSuggestions';
import { VizTypePicker } from 'app/features/panel/components/VizTypePicker/VizTypePicker';
import { VizTypeChangeDetails } from 'app/features/panel/components/VizTypePicker/types';

import { PanelModelCompatibilityWrapper } from '../utils/PanelModelCompatibilityWrapper';

import { INTERACTION_EVENT_NAME, INTERACTION_ITEM } from './interaction';

export interface Props {
  data?: PanelData;
  showBackButton?: boolean;
  panel: VizPanel;
  editPreview: VizPanel;
  onChange: (options: VizTypeChangeDetails, panel?: VizPanel) => void;
  onClose: () => void;
  isNewPanel?: boolean;
}

const getTabs = (): Array<{ label: string; value: VisualizationSelectPaneTab }> => {
  const suggestionsTab = {
    label: t('dashboard-scene.panel-viz-type-picker.radio-options.label.suggestions', 'Suggestions'),
    value: VisualizationSelectPaneTab.Suggestions,
  };
  const allVisualizationsTab = {
    label: t('dashboard-scene.panel-viz-type-picker.radio-options.label.all-visualizations', 'All visualizations'),
    value: VisualizationSelectPaneTab.Visualizations,
  };
  return config.featureToggles.newVizSuggestions
    ? [suggestionsTab, allVisualizationsTab]
    : [allVisualizationsTab, suggestionsTab];
};

export function PanelVizTypePicker({ panel, editPreview, data, onChange, onClose, showBackButton, isNewPanel }: Props) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const panelModel = useMemo(() => new PanelModelCompatibilityWrapper(panel), [panel]);
  const filterId = useId();
  const [searchInputRef, setSearchInputRef] = useState<HTMLInputElement | null>(null);

  const isMobile = useMedia(`(max-width: ${theme.breakpoints.values.sm}px)`);

  useEffect(() => {
    if (searchInputRef && !isMobile) {
      searchInputRef.focus();
    }
  }, [searchInputRef, isMobile]);

  /** SEARCH */
  const [searchQuery, setSearchQuery] = useState('');
  const trackSearch = useMemo(
    () =>
      debounce((q, count) => {
        if (q) {
          reportInteraction(INTERACTION_EVENT_NAME, {
            item: INTERACTION_ITEM.SEARCH,
            query: q,
            result_count: count,
            creator_team: 'grafana_plugins_catalog',
            schema_version: '1.0.0',
          });
        }
      }, 300),
    []
  );

  /** TABS */
  const tabs = useMemo(getTabs, []);
  const defaultTab = tabs[0].value;
  const [listMode, setListMode] = useSessionStorage(LS_VISUALIZATION_SELECT_TAB_KEY, defaultTab);

  const handleListModeChange = useCallback(
    (value: VisualizationSelectPaneTab) => {
      reportInteraction(INTERACTION_EVENT_NAME, {
        item: INTERACTION_ITEM.CHANGE_TAB,
        tab: VisualizationSelectPaneTab[value],
        creator_team: 'grafana_plugins_catalog',
        schema_version: '1.0.0',
      });
      setListMode(value);
    },
    [setListMode]
  );

  const handleBackButtonClick = useCallback(() => {
    reportInteraction(INTERACTION_EVENT_NAME, {
      item: INTERACTION_ITEM.BACK_BUTTON,
      tab: VisualizationSelectPaneTab[listMode],
      creator_team: 'grafana_plugins_catalog',
      schema_version: '1.0.0',
    });
    onClose();
  }, [listMode, onClose]);

  return (
    <div className={styles.wrapper}>
      <TabsBar className={styles.tabs} hideBorder={true}>
        {tabs.map((tab) => (
          <Tab
            className={styles.tab}
            key={tab.value}
            label={tab.label}
            active={listMode === tab.value}
            onChangeTab={() => handleListModeChange(tab.value)}
          />
        ))}
      </TabsBar>
      <ScrollContainer>
        <TabContent className={styles.tabContent}>
          <Stack gap={1} direction="column">
            <Field
              tabIndex={0}
              className={styles.searchField}
              noMargin
              htmlFor={filterId}
              aria-label={t('dashboard-scene.panel-viz-type-picker.placeholder-search-for', 'Search for...')}
            >
              <Stack direction="row" gap={1}>
                {showBackButton && (
                  <Button
                    aria-label={t('dashboard-scene.panel-viz-type-picker.title-close', 'Close')}
                    fill="text"
                    variant="secondary"
                    icon="arrow-left"
                    data-testid={selectors.components.PanelEditor.toggleVizPicker}
                    onClick={handleBackButtonClick}
                  >
                    <Trans i18nKey="dashboard-scene.panel-viz-type-picker.button.close">Back</Trans>
                  </Button>
                )}
                <FilterInput
                  id={filterId}
                  className={styles.filter}
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={t('dashboard-scene.panel-viz-type-picker.placeholder-search-for', 'Search for...')}
                />
              </Stack>
            </Field>

            {listMode === VisualizationSelectPaneTab.Suggestions && (
              <VisualizationSuggestions
                onChange={onChange}
                panel={panelModel}
                editPreview={editPreview}
                data={data}
                searchQuery={searchQuery}
                isNewPanel={isNewPanel}
              />
            )}
            {listMode === VisualizationSelectPaneTab.Visualizations && (
              <VizTypePicker
                pluginId={panel.state.pluginId}
                searchQuery={searchQuery}
                trackSearch={trackSearch}
                onChange={onChange}
              />
            )}
          </Stack>
        </TabContent>
      </ScrollContainer>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    height: '100%',
    gap: theme.spacing(2),
  }),
  searchField: css({
    margin: theme.spacing(0.5, 0, 1, 0), // input glow with the boundary without this
  }),
  tabs: css({
    width: '100%',
  }),
  tab: css({
    flexGrow: 1,
    justifyContent: 'center',
    textAlign: 'center',
  }),
  tabContent: css({
    paddingInline: theme.spacing(2),
  }),
  closeButton: css({
    marginLeft: 'auto',
  }),
  customFieldMargin: css({
    marginBottom: theme.spacing(1),
  }),
  filter: css({
    minHeight: theme.spacing(4),
  }),
});
