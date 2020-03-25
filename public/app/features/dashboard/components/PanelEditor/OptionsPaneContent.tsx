import React, { useCallback, useState } from 'react';
import { FieldConfigSource, GrafanaTheme, PanelData, PanelPlugin } from '@grafana/data';
import { DashboardModel, PanelModel } from '../../state';
import { CustomScrollbar, stylesFactory, Tab, TabContent, TabsBar, useTheme, Container } from '@grafana/ui';
import { DefaultFieldConfigEditor, OverrideFieldConfigEditor } from './FieldConfigEditor';
import { AngularPanelOptions } from './AngularPanelOptions';
import { css } from 'emotion';
import { GeneralPanelOptions } from './GeneralPanelOptions';

export const OptionsPaneContent: React.FC<{
  plugin?: PanelPlugin;
  panel: PanelModel;
  data: PanelData;
  dashboard: DashboardModel;
  onFieldConfigsChange: (config: FieldConfigSource) => void;
  onPanelOptionsChanged: (options: any) => void;
  onPanelConfigChange: (configKey: string, value: any) => void;
}> = ({ plugin, panel, data, onFieldConfigsChange, onPanelOptionsChanged, onPanelConfigChange, dashboard }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  const renderFieldOptions = useCallback(
    (plugin: PanelPlugin) => {
      const fieldConfig = panel.getFieldConfig();

      if (!fieldConfig) {
        return null;
      }

      return (
        <Container padding="md">
          {renderCustomPanelSettings(plugin)}
          <DefaultFieldConfigEditor
            config={fieldConfig}
            plugin={plugin}
            onChange={onFieldConfigsChange}
            data={data.series}
          />
        </Container>
      );
    },
    [data, plugin, panel, onFieldConfigsChange]
  );

  const renderFieldOverrideOptions = useCallback(
    (plugin: PanelPlugin) => {
      const fieldConfig = panel.getFieldConfig();

      if (!fieldConfig) {
        return null;
      }

      return (
        <OverrideFieldConfigEditor
          config={fieldConfig}
          plugin={plugin}
          onChange={onFieldConfigsChange}
          data={data.series}
        />
      );
    },
    [data, plugin, panel, onFieldConfigsChange]
  );

  const renderCustomPanelSettings = useCallback(
    (plugin: PanelPlugin) => {
      if (plugin.editor && panel) {
        return (
          <div className={styles.legacyOptions}>
            <plugin.editor
              data={data}
              options={panel.getOptions()}
              onOptionsChange={onPanelOptionsChanged}
              fieldConfig={panel.getFieldConfig()}
              onFieldConfigChange={onFieldConfigsChange}
            />
          </div>
        );
      }

      return (
        <div className={styles.legacyOptions}>
          <AngularPanelOptions panel={panel} dashboard={dashboard} plugin={plugin} />
        </div>
      );
    },
    [data, plugin, panel, onFieldConfigsChange]
  );

  const [activeTab, setActiveTab] = useState('defaults');

  return (
    <div className={styles.panelOptionsPane}>
      {plugin && (
        <div className={styles.wrapper}>
          <TabsBar>
            <Tab label="Options" active={activeTab === 'defaults'} onChangeTab={() => setActiveTab('defaults')} />
            <Tab label="Overrides" active={activeTab === 'overrides'} onChangeTab={() => setActiveTab('overrides')} />
            <Tab label="General" active={activeTab === 'panel'} onChangeTab={() => setActiveTab('panel')} />
          </TabsBar>
          <TabContent className={styles.tabContent}>
            <CustomScrollbar>
              {activeTab === 'defaults' && renderFieldOptions(plugin)}
              {activeTab === 'overrides' && renderFieldOverrideOptions(plugin)}
              {activeTab === 'panel' && <GeneralPanelOptions panel={panel} onPanelConfigChange={onPanelConfigChange} />}
            </CustomScrollbar>
          </TabContent>
        </div>
      )}
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      display: flex;
      flex-direction: column;
      height: 100%;
    `,
    panelOptionsPane: css`
      height: 100%;
      width: 100%;
      border-bottom: none;
    `,
    tabContent: css`
      padding: 0;
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      min-height: 0;
      background: ${theme.colors.pageBg};
      border-left: 1px solid ${theme.colors.pageHeaderBorder};
    `,
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
