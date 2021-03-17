import React, { useCallback } from 'react';
import { FieldConfigSource, GrafanaTheme, PanelPlugin } from '@grafana/data';
import { DashboardModel, PanelModel } from '../../state';
import { CustomScrollbar, stylesFactory, useTheme } from '@grafana/ui';
import { OverrideFieldConfigEditor } from './OverrideFieldConfigEditor';
import { DefaultFieldConfigEditor } from './DefaultFieldConfigEditor';
import { css } from 'emotion';
import { PanelOptionsTab } from './PanelOptionsTab';
import { usePanelLatestData } from './usePanelLatestData';
import { selectors } from '@grafana/e2e-selectors';
import { VisualizationButton } from './VisualizationButton';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
import { OptionsBox } from './OptionsBox';
import { PanelOptionsEditor } from './PanelOptionsEditor';

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

  return (
    <div className={styles.wrapper} aria-label={selectors.components.PanelEditor.OptionsPane.content}>
      <CustomScrollbar autoHeightMin="100%">
        <div className={styles.panelOptionsPane}>
          <div className={styles.vizButtonWrapper}>
            <VisualizationButton panel={panel} />
          </div>
          <div className={styles.searchBox}>
            <FilterInput width={0} value={''} onChange={() => {}} placeholder={'Search options'} />
          </div>

          <OptionsBox>
            <PanelOptionsTab
              panel={panel}
              plugin={plugin}
              dashboard={dashboard}
              data={data}
              onPanelConfigChange={onPanelConfigChange}
              onPanelOptionsChanged={onPanelOptionsChanged}
            />
          </OptionsBox>

          <OptionsBox>
            {plugin.optionEditors && (
              <PanelOptionsEditor
                key="panel options"
                options={panel.getOptions()}
                onChange={onPanelOptionsChanged}
                replaceVariables={panel.replaceVariables}
                plugin={plugin}
                data={data?.series}
                eventBus={dashboard.events}
              />
            )}
            {renderFieldOptions(plugin)}
          </OptionsBox>

          {renderFieldOverrideOptions(plugin)}
        </div>
      </CustomScrollbar>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      height: 100%;
      width: 100%;
      padding-right: ${theme.spacing.sm};
    `,
    panelOptionsPane: css`
      display: flex;
      flex-direction: column;
      padding-top: ${theme.spacing.md};
    `,
    tabsBar: css`
      padding-right: ${theme.spacing.sm};
    `,
    vizButtonWrapper: css`
      padding: 0 0 ${theme.spacing.md} 0;
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
    searchBox: css`
      margin-bottom: ${theme.spacing.md};
      padding: 0;
      display: flex;
      flex-direction: column;
      min-height: 0;
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
