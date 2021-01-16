import React, { useState, useCallback } from 'react';
import { FieldConfigSource, GrafanaTheme, PanelPlugin } from '@grafana/data';
import { DashboardModel, PanelModel } from '../../state';
import { CustomScrollbar, Icon, stylesFactory, TabContent, useStyles, useTheme } from '@grafana/ui';
import { OverrideFieldConfigEditor } from './OverrideFieldConfigEditor';
import { DefaultFieldConfigEditor } from './DefaultFieldConfigEditor';
import { css } from 'emotion';
import { PanelOptionsTab } from './PanelOptionsTab';
import { DashNavButton } from 'app/features/dashboard/components/DashNav/DashNavButton';
import { usePanelLatestData } from './usePanelLatestData';
import { selectors } from '@grafana/e2e-selectors';
import { VisualizationTab } from './VisualizationTab';

interface Props {
  plugin: PanelPlugin;
  panel: PanelModel;
  width: number;
  dashboard: DashboardModel;
  onClose: () => void;
  onFieldConfigsChange: (config: FieldConfigSource) => void;
  onPanelOptionsChanged: (options: any) => void;
  onPanelConfigChange: (configKey: string, value: any) => void;
}

export const OptionsPaneContent: React.FC<Props> = ({
  plugin,
  panel,
  width,
  onFieldConfigsChange,
  onPanelOptionsChanged,
  onPanelConfigChange,
  onClose,
  dashboard,
}: Props) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [vizPickerIsOpen, setVizPickerIsOpen] = useState(false);
  //const [isSearching, setSearchMode] = useState(false);
  const { data, hasSeries } = usePanelLatestData(panel, { withTransforms: true, withFieldConfig: false });

  const renderFieldOptions = useCallback(
    (plugin: PanelPlugin) => {
      const fieldConfig = panel.getFieldConfig();

      if (!fieldConfig || !hasSeries) {
        return null;
      }

      return (
        <DefaultFieldConfigEditor
          config={fieldConfig}
          plugin={plugin}
          onChange={onFieldConfigsChange}
          /* hasSeries makes sure current data is there */
          data={data!.series}
        />
      );
    },
    [data, plugin, panel, onFieldConfigsChange]
  );

  const renderFieldOverrideOptions = useCallback(
    (plugin: PanelPlugin) => {
      const fieldConfig = panel.getFieldConfig();

      if (!fieldConfig || !hasSeries) {
        return null;
      }

      return (
        <OverrideFieldConfigEditor
          config={fieldConfig}
          plugin={plugin}
          onChange={onFieldConfigsChange}
          /* hasSeries makes sure current data is there */
          data={data!.series}
        />
      );
    },
    [data, plugin, panel, onFieldConfigsChange]
  );

  // When the panel has no query only show the main tab
  //const showMainTab = activeTab === 'options' || plugin.meta.skipDataQuery;
  const onToggleVizPicker = () => {
    setVizPickerIsOpen(!vizPickerIsOpen);
  };

  return (
    <div className={styles.panelOptionsPane} aria-label={selectors.components.PanelEditor.OptionsPane.content}>
      <VisualizationButtons plugin={plugin} styles={styles} onClose={onClose} onToggleVizPicker={onToggleVizPicker} />
      <CustomScrollbar autoHeightMin="100%">
        <div className={styles.wrapper}>
          {vizPickerIsOpen && <VisualizationTab panel={panel} onClose={onToggleVizPicker} />}
          <TabContent className={styles.tabContent}>
            <PanelOptionsTab
              panel={panel}
              plugin={plugin}
              dashboard={dashboard}
              data={data}
              onPanelConfigChange={onPanelConfigChange}
              onPanelOptionsChanged={onPanelOptionsChanged}
            />
            {renderFieldOptions(plugin)}
            {renderFieldOverrideOptions(plugin)}
          </TabContent>
        </div>
      </CustomScrollbar>
    </div>
  );
};

export const VisualizationButtons: React.FC<{
  plugin: PanelPlugin;
  onToggleVizPicker: () => void;
  onClose: () => void;
  styles: OptionsPaneStyles;
}> = ({ plugin, onToggleVizPicker, onClose, styles }) => {
  return (
    <div className={styles.vizButtonBar}>
      <VizButton plugin={plugin} onClick={onToggleVizPicker} />
      <DashNavButton icon="search" tooltip="Search options" />
      <DashNavButton icon="minus-square" tooltip="Collapse all sections" />
      <DashNavButton icon="plus-square" tooltip="Expand all sections" />
      <DashNavButton icon="cog" onClick={onClose} tooltip="Close options pane" />
    </div>
  );
};

export const VizButton: React.FC<{
  plugin: PanelPlugin;
  onClick: () => void;
}> = ({ plugin, onClick }) => {
  const styles = useStyles((theme: GrafanaTheme) => ({
    button: css`
      background: ${theme.colors.bg1};
      border: 1px solid ${theme.colors.border1};
      height: ${theme.height.md}px;
      padding: 0 ${theme.spacing.sm};
      color: ${theme.colors.textWeak};
      display: flex;
      align-items: center;
      flex-grow: 1;

      &:focus {
        outline: none;
      }

      &:hover {
        color: ${theme.colors.textStrong};
      }

      span {
        flex-grow: 1;
        text-align: left;
      }

      img {
        width: 16px;
        height: 16px;
        margin-right: ${theme.spacing.sm};
      }

      svg {
        margin-left: ${theme.spacing.xs};
      }
    `,
  }));

  return (
    <button className={styles.button} onClick={onClick}>
      <img src={plugin.meta.info.logos.small} />
      <span>{plugin.meta.name}</span>
      <Icon name="angle-down" />
    </button>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      display: flex;
      flex-direction: column;
      min-height: 100%;
      padding-top: ${theme.spacing.md};
    `,
    panelOptionsPane: css`
      padding-top: ${theme.spacing.md};
      height: 100%;
      width: 100%;
    `,
    tabsBar: css`
      padding-right: ${theme.spacing.sm};
    `,
    searchWrapper: css`
      display: flex;
      flex-grow: 1;
      flex-direction: row-reverse;
    `,
    searchInput: css`
      color: ${theme.colors.textWeak};
      flex-grow: 1;
    `,
    searchRemoveIcon: css`
      cursor: pointer;
    `,
    tabContent: css`
      padding: 0;
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      background: ${theme.colors.bodyBg};
      border-left: 1px solid ${theme.colors.pageHeaderBorder};
      border-top: 1px solid ${theme.colors.pageHeaderBorder};
    `,
    vizButtonBar: css`
      display: flex;
      flex-direction: row;
      flex-grow: 1;
      margin-right: ${theme.spacing.xs};
    `,
    tabsButton: css``,
    legacyOptions: css`
      label: legacy-options;
      .panel-options-grid {
        display: flex;
        flex-direction: column;
      }
      .panel-options-group {
        margin-bottom: 0;
      }
      .panel-options-group__body {
        padding: ${theme.spacing.md} 0;
      }

      .section {
        display: block;
        margin: ${theme.spacing.md} 0;

        &:first-child {
          margin-top: 0;
        }
      }
    `,
  };
});

type OptionsPaneStyles = ReturnType<typeof getStyles>;
