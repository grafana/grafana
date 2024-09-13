import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from 'react-use';

import { GrafanaTheme2, PanelData, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Button, CustomScrollbar, Field, FilterInput, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { LS_VISUALIZATION_SELECT_TAB_KEY, LS_WIDGET_SELECT_TAB_KEY } from 'app/core/constants';
import { VisualizationSelectPaneTab } from 'app/features/dashboard/components/PanelEditor/types';
import { VisualizationSuggestions } from 'app/features/panel/components/VizTypePicker/VisualizationSuggestions';
import { VizTypePicker } from 'app/features/panel/components/VizTypePicker/VizTypePicker';
import { VizTypeChangeDetails } from 'app/features/panel/components/VizTypePicker/types';

import { PanelModelCompatibilityWrapper } from '../utils/PanelModelCompatibilityWrapper';

import { VizPanelManager } from './VizPanelManager';

export interface Props {
  data?: PanelData;
  vizManager: VizPanelManager;
  onChange: () => void;
}

export function PanelVizTypePicker({ vizManager, data, onChange }: Props) {
  const { panel } = vizManager.useState();
  const styles = useStyles2(getStyles);
  const [searchQuery, setSearchQuery] = useState('');

  const isWidgetEnabled = false;
  const tabKey = isWidgetEnabled ? LS_WIDGET_SELECT_TAB_KEY : LS_VISUALIZATION_SELECT_TAB_KEY;
  const defaultTab = isWidgetEnabled ? VisualizationSelectPaneTab.Widgets : VisualizationSelectPaneTab.Visualizations;
  const panelModel = useMemo(() => new PanelModelCompatibilityWrapper(panel), [panel]);

  const supportedListModes = useMemo(
    () =>
      new Set([
        VisualizationSelectPaneTab.Widgets,
        VisualizationSelectPaneTab.Visualizations,
        VisualizationSelectPaneTab.Suggestions,
      ]),
    []
  );
  const [listMode, setListMode] = useLocalStorage(tabKey, defaultTab);
  useEffect(() => {
    if (listMode && !supportedListModes.has(listMode)) {
      setListMode(defaultTab);
    }
  }, [defaultTab, listMode, setListMode, supportedListModes]);

  const radioOptions: Array<SelectableValue<VisualizationSelectPaneTab>> = [
    { label: 'Visualizations', value: VisualizationSelectPaneTab.Visualizations },
    { label: 'Suggestions', value: VisualizationSelectPaneTab.Suggestions },
    // {
    //   label: 'Library panels',
    //   value: VisualizationSelectPaneTab.LibraryPanels,
    //   description: 'Reusable panels you can share between multiple dashboards.',
    // },
  ];

  const onVizTypeChange = (options: VizTypeChangeDetails) => {
    vizManager.changePluginType(options.pluginId);
    onChange();
  };

  const onCloseVizPicker = () => {
    onChange();
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.searchRow}>
        <FilterInput
          className={styles.filter}
          value={searchQuery}
          onChange={setSearchQuery}
          autoFocus={true}
          placeholder="Search for..."
        />
        <Button
          title="Close"
          variant="secondary"
          icon="angle-up"
          className={styles.closeButton}
          data-testid={selectors.components.PanelEditor.toggleVizPicker}
          onClick={onCloseVizPicker}
        />
      </div>
      <Field className={styles.customFieldMargin}>
        <RadioButtonGroup options={radioOptions} value={listMode} onChange={setListMode} fullWidth />
      </Field>
      <CustomScrollbar>
        {listMode === VisualizationSelectPaneTab.Visualizations && (
          <VizTypePicker pluginId={panel.state.pluginId} searchQuery={searchQuery} onChange={onVizTypeChange} />
        )}
        {/* {listMode === VisualizationSelectPaneTab.Widgets && (
                <VizTypePicker pluginId={plugin.meta.id} onChange={onVizChange} searchQuery={searchQuery} isWidget />
              )} */}
        {listMode === VisualizationSelectPaneTab.Suggestions && (
          <VisualizationSuggestions
            onChange={onVizTypeChange}
            searchQuery={searchQuery}
            panel={panelModel}
            data={data}
          />
        )}
      </CustomScrollbar>
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
