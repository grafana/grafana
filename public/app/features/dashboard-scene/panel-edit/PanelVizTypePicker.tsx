import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from 'react-use';

import { GrafanaTheme2, PanelData, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { Button, Field, FilterInput, RadioButtonGroup, ScrollContainer, useStyles2 } from '@grafana/ui';
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
  const defaultTab = VisualizationSelectPaneTab.Visualizations;
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

  const radioOptions: Array<SelectableValue<VisualizationSelectPaneTab>> = [
    {
      label: t('dashboard-scene.panel-viz-type-picker.radio-options.label.visualizations', 'Visualizations'),
      value: VisualizationSelectPaneTab.Visualizations,
    },
    {
      label: t('dashboard-scene.panel-viz-type-picker.radio-options.label.suggestions', 'Suggestions'),
      value: VisualizationSelectPaneTab.Suggestions,
    },
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.searchRow}>
        <FilterInput
          className={styles.filter}
          value={searchQuery}
          onChange={handleSearchChange}
          autoFocus={true}
          placeholder={t('dashboard-scene.panel-viz-type-picker.placeholder-search-for', 'Search for...')}
        />
        <Button
          title={t('dashboard-scene.panel-viz-type-picker.title-close', 'Close')}
          variant="secondary"
          icon="angle-up"
          className={styles.closeButton}
          data-testid={selectors.components.PanelEditor.toggleVizPicker}
          onClick={onClose}
        />
      </div>
      <Field className={styles.customFieldMargin}>
        <RadioButtonGroup options={radioOptions} value={listMode} onChange={handleListModeChange} fullWidth />
      </Field>
      <ScrollContainer>
        {listMode === VisualizationSelectPaneTab.Visualizations && (
          <VizTypePicker
            pluginId={panel.state.pluginId}
            searchQuery={searchQuery}
            trackSearch={trackSearch}
            onChange={onChange}
          />
        )}
        {listMode === VisualizationSelectPaneTab.Suggestions && (
          <VisualizationSuggestions
            onChange={onChange}
            trackSearch={trackSearch}
            searchQuery={searchQuery}
            panel={panelModel}
            data={data}
          />
        )}
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
    border: `1px solid ${theme.colors.border.weak}`,
    borderRight: 'none',
    borderBottom: 'none',
    borderTopLeftRadius: theme.shape.radius.default,
  }),
  searchRow: css({
    display: 'flex',
    marginBottom: theme.spacing(1),
  }),
  closeButton: css({
    marginLeft: theme.spacing(1),
  }),
  customFieldMargin: css({
    marginBottom: theme.spacing(1),
  }),
  filter: css({
    minHeight: theme.spacing(4),
  }),
});
