import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { useCallback, useId, useMemo, useState } from 'react';
import { useSessionStorage } from 'react-use';

import { GrafanaTheme2, PanelData } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { Button, Field, FilterInput, ScrollContainer, Stack, Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';
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
  onChange: (options: VizTypeChangeDetails) => void;
  onClose: () => void;
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

export function PanelVizTypePicker({ panel, data, onChange, onClose, showBackButton }: Props) {
  const styles = useStyles2(getStyles);
  const panelModel = useMemo(() => new PanelModelCompatibilityWrapper(panel), [panel]);
  const filterId = useId();

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
          {listMode === VisualizationSelectPaneTab.Suggestions && (
            <VisualizationSuggestions onChange={onChange} panel={panelModel} data={data} />
          )}
          {listMode === VisualizationSelectPaneTab.Visualizations && (
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
                      onClick={onClose}
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

              <VizTypePicker
                pluginId={panel.state.pluginId}
                searchQuery={searchQuery}
                trackSearch={trackSearch}
                onChange={onChange}
              />
            </Stack>
          )}
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
    marginTop: theme.spacing(0.5), // input glow with the boundary without this
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
