import React from 'react';
import { FieldConfigSource, GrafanaTheme, PanelPlugin } from '@grafana/data';
import { DashboardModel, PanelModel } from '../../state';
import { CustomScrollbar, Field, stylesFactory, useTheme } from '@grafana/ui';
import { css } from 'emotion';
import { usePanelLatestData } from './usePanelLatestData';
import { selectors } from '@grafana/e2e-selectors';
import { VisualizationButton } from './VisualizationButton';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
import { OptionPaneRenderProps, OptionsPaneGroup } from './types';
import { getPanelFrameOptions } from './getPanelFrameOptions';
import { OptionsGroup } from './OptionsGroup';
import { getFieldOverrides, getVizualizationOptions } from './getVizualizationOptions';

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
  const { data } = usePanelLatestData(panel, { withTransforms: true, withFieldConfig: false });
  const topGroups: OptionsPaneGroup[] = [];
  const optionProps: OptionPaneRenderProps = {
    panel,
    onPanelOptionsChanged,
    onPanelConfigChange,
    onFieldConfigsChange,
    plugin,
    data,
    eventBus: dashboard.events,
  };

  topGroups.push(getPanelFrameOptions(optionProps));
  topGroups.push(...getVizualizationOptions(optionProps));
  topGroups.push(...getFieldOverrides(optionProps));

  return (
    <div className={styles.wrapper} aria-label={selectors.components.PanelEditor.OptionsPane.content}>
      <CustomScrollbar autoHeightMin="100%">
        <div className={styles.panelOptionsPane}>
          <div className={styles.vizButtonWrapper}>
            <VisualizationButton panel={panel} />
          </div>

          <div className={styles.paneBg}>
            <div className={styles.searchBox}>
              <FilterInput width={0} value={''} onChange={() => {}} placeholder={'Search options'} />
            </div>

            {topGroups.map((topGroup) => (
              <OptionsGroup key={topGroup.title} title={topGroup.title} id={topGroup.title}>
                {topGroup.items?.map((child1) => (
                  <Field label={child1.title} description={child1.description} key={child1.title}>
                    {child1.reactNode!}
                  </Field>
                ))}
                {topGroup.groups?.map((childGroup) => (
                  <OptionsGroup id={childGroup.title} key={childGroup.title} title={childGroup.title} defaultToClosed>
                    {childGroup.items?.map((child2) => (
                      <Field label={child2.title} description={child2.description} key={child2.title}>
                        {child2.reactNode!}
                      </Field>
                    ))}
                  </OptionsGroup>
                ))}
              </OptionsGroup>
            ))}
          </div>
        </div>
      </CustomScrollbar>
    </div>
  );
};

{
  /* <OptionsBox>
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
          </OptionsBox> */
}

// const renderFieldOptions = useCallback(
//   (plugin: PanelPlugin) => {
//     const fieldConfig = panel.getFieldConfig();

//     if (!fieldConfig || !hasSeries) {
//       return null;
//     }

//     return (
//       <DefaultFieldConfigEditor
//         config={fieldConfig}
//         plugin={plugin}
//         onChange={onFieldConfigsChange}
//         /* hasSeries makes sure current data is there */
//         data={data!.series}
//       />
//     );
//   },
//   [data, plugin, panel, onFieldConfigsChange]
// );

// const renderFieldOverrideOptions = useCallback(
//   (plugin: PanelPlugin) => {
//     const fieldConfig = panel.getFieldConfig();

//     if (!fieldConfig || !hasSeries) {
//       return null;
//     }

//     return (
//       <OverrideFieldConfigEditor
//         config={fieldConfig}
//         plugin={plugin}
//         onChange={onFieldConfigsChange}
//         /* hasSeries makes sure current data is there */
//         data={data!.series}
//       />
//     );
//   },
//   [data, plugin, panel, onFieldConfigsChange]
// );

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
    paneBg: css`
      background: ${theme.colors.bg1};
      border: 1px solid ${theme.colors.border1};
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
    itemsPadding: css`
      padding: ${theme.spacing.md};
    `,
    searchBox: css`
      padding: ${theme.spacing.sm};
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
