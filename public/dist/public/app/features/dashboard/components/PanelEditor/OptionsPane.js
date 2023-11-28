import { css } from '@emotion/css';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { useStyles2 } from '@grafana/ui';
import { useSelector } from 'app/types';
import { OptionsPaneOptions } from './OptionsPaneOptions';
import { VisualizationButton } from './VisualizationButton';
import { VisualizationSelectPane } from './VisualizationSelectPane';
import { usePanelLatestData } from './usePanelLatestData';
export const OptionsPane = ({ plugin, panel, onFieldConfigsChange, onPanelOptionsChanged, onPanelConfigChange, dashboard, instanceState, }) => {
    const styles = useStyles2(getStyles);
    const isVizPickerOpen = useSelector((state) => state.panelEditor.isVizPickerOpen);
    const { data } = usePanelLatestData(panel, { withTransforms: true, withFieldConfig: false }, true);
    return (React.createElement("div", { className: styles.wrapper, "aria-label": selectors.components.PanelEditor.OptionsPane.content },
        !isVizPickerOpen && (React.createElement(React.Fragment, null,
            React.createElement("div", { className: styles.vizButtonWrapper },
                React.createElement(VisualizationButton, { panel: panel })),
            React.createElement("div", { className: styles.optionsWrapper },
                React.createElement(OptionsPaneOptions, { panel: panel, dashboard: dashboard, plugin: plugin, instanceState: instanceState, data: data, onFieldConfigsChange: onFieldConfigsChange, onPanelOptionsChanged: onPanelOptionsChanged, onPanelConfigChange: onPanelConfigChange })))),
        isVizPickerOpen && React.createElement(VisualizationSelectPane, { panel: panel, data: data })));
};
const getStyles = (theme) => {
    return {
        wrapper: css `
      height: 100%;
      width: 100%;
      display: flex;
      flex: 1 1 0;
      flex-direction: column;
      padding: 0;
    `,
        optionsWrapper: css `
      flex-grow: 1;
      min-height: 0;
    `,
        vizButtonWrapper: css `
      padding: 0 ${theme.spacing(2, 2)} 0;
    `,
        legacyOptions: css `
      label: legacy-options;
      .panel-options-grid {
        display: flex;
        flex-direction: column;
      }
      .panel-options-group {
        margin-bottom: 0;
      }
      .panel-options-group__body {
        padding: ${theme.spacing(2)} 0;
      }

      .section {
        display: block;
        margin: ${theme.spacing(2)} 0;

        &:first-child {
          margin-top: 0;
        }
      }
    `,
    };
};
//# sourceMappingURL=OptionsPane.js.map