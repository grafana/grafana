import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from 'react-use';

import { GrafanaTheme2, PanelData } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { FilterInput, ScrollContainer, Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';
import { LS_VISUALIZATION_SELECT_TAB_KEY } from 'app/core/constants';
import { VisualizationSelectPaneTab } from 'app/features/dashboard/components/PanelEditor/types';
import { VisualizationSuggestions } from 'app/features/panel/components/VizTypePicker/VisualizationSuggestions';
import { VizTypePicker } from 'app/features/panel/components/VizTypePicker/VizTypePicker';
import { VizTypeChangeDetails } from 'app/features/panel/components/VizTypePicker/types';

import { PanelModelCompatibilityWrapper } from '../utils/PanelModelCompatibilityWrapper';

import { INTERACTION_EVENT_NAME, INTERACTION_ITEM } from './interaction';

export interface Props {
  data?: PanelData;
  panel: VizPanel;
  onChange: (options: VizTypeChangeDetails) => void;
  onClose: () => void;
}

export function PanelVizTypePicker({ panel, data, onChange, onClose }: Props) {
  const styles = useStyles2(getStyles);
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

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const tabKey = LS_VISUALIZATION_SELECT_TAB_KEY;
  const defaultTab = config.featureToggles.newVizSuggestions
    ? VisualizationSelectPaneTab.Suggestions
    : VisualizationSelectPaneTab.Visualizations;
  const panelModel = useMemo(() => new PanelModelCompatibilityWrapper(panel), [panel]);

  const supportedListModes = useMemo(
    () => new Set([VisualizationSelectPaneTab.Visualizations, VisualizationSelectPaneTab.Suggestions]),
    []
  );
  const [listMode, setListMode] = useLocalStorage(tabKey, defaultTab);
  const handleListModeChange = (value: VisualizationSelectPaneTab) => {
    reportInteraction(INTERACTION_EVENT_NAME, {
      item: INTERACTION_ITEM.CHANGE_TAB,
      tab: VisualizationSelectPaneTab[value],
      creator_team: 'grafana_plugins_catalog',
      schema_version: '1.0.0',
    });
    setListMode(value);
  };

  useEffect(() => {
    if (listMode && !supportedListModes.has(listMode)) {
      setListMode(defaultTab);
    }
  }, [defaultTab, listMode, setListMode, supportedListModes]);

  return (
    <div className={styles.wrapper}>
      {/*@TODO: Re-enable/move close button*/}
      {/*<Button*/}
      {/*  aria-label={t('dashboard-scene.panel-viz-type-picker.title-close', 'Close')}*/}
      {/*  variant="secondary"*/}
      {/*  icon="angle-up"*/}
      {/*  className={styles.closeButton}*/}
      {/*  data-testid={selectors.components.PanelEditor.toggleVizPicker}*/}
      {/*  onClick={onClose}*/}
      {/*/>*/}
      <TabsBar hideBorder={true}>
        <Tab
          label={t('dashboard-scene.panel-viz-type-picker.radio-options.label.suggestions', 'Suggestions')}
          active={listMode === VisualizationSelectPaneTab.Suggestions}
          onChangeTab={() => {
            handleListModeChange(VisualizationSelectPaneTab.Suggestions);
          }}
        />
        <Tab
          label={t(
            'dashboard-scene.panel-viz-type-picker.radio-options.label.all-visualizations',
            'All visualizations'
          )}
          active={listMode === VisualizationSelectPaneTab.Visualizations}
          onChangeTab={() => {
            handleListModeChange(VisualizationSelectPaneTab.Visualizations);
          }}
        />
      </TabsBar>
      <ScrollContainer>
        <TabContent>
          {listMode === VisualizationSelectPaneTab.Suggestions && (
            <VisualizationSuggestions onChange={onChange} panel={panelModel} data={data} />
          )}
          {listMode === VisualizationSelectPaneTab.Visualizations && (
            <>
              <div className={styles.searchRow}>
                <FilterInput
                  className={styles.filter}
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder={t('dashboard-scene.panel-viz-type-picker.placeholder-search-for', 'Search for...')}
                />
              </div>
              <VizTypePicker
                pluginId={panel.state.pluginId}
                searchQuery={searchQuery}
                trackSearch={trackSearch}
                onChange={onChange}
              />
            </>
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
    padding: theme.spacing(2, 1),
    height: '100%',
    gap: theme.spacing(2),
  }),
  searchRow: css({
    display: 'flex',
    marginBottom: theme.spacing(2),
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
