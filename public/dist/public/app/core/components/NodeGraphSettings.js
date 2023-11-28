import { css } from '@emotion/css';
import React from 'react';
import { updateDatasourcePluginJsonDataOption, } from '@grafana/data';
import { ConfigSubSection } from '@grafana/experimental';
import { InlineField, InlineFieldRow, InlineSwitch, useStyles2 } from '@grafana/ui';
import { ConfigDescriptionLink } from './ConfigDescriptionLink';
export function NodeGraphSettings({ options, onOptionsChange }) {
    var _a;
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.container },
        React.createElement(InlineFieldRow, { className: styles.row },
            React.createElement(InlineField, { tooltip: "Displays the node graph above the trace view. Default: disabled", label: "Enable node graph", labelWidth: 26 },
                React.createElement(InlineSwitch, { id: "enableNodeGraph", value: (_a = options.jsonData.nodeGraph) === null || _a === void 0 ? void 0 : _a.enabled, onChange: (event) => updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'nodeGraph', Object.assign(Object.assign({}, options.jsonData.nodeGraph), { enabled: event.currentTarget.checked })) })))));
}
export const NodeGraphSection = ({ options, onOptionsChange }) => {
    return (React.createElement(ConfigSubSection, { title: "Node graph", description: React.createElement(ConfigDescriptionLink, { description: "Show or hide the node graph visualization.", suffix: `${options.type}/#node-graph`, feature: "the node graph" }) },
        React.createElement(NodeGraphSettings, { options: options, onOptionsChange: onOptionsChange })));
};
const getStyles = (theme) => ({
    infoText: css `
    label: infoText;
    padding-bottom: ${theme.spacing(2)};
    color: ${theme.colors.text.secondary};
  `,
    container: css `
    label: container;
    width: 100%;
  `,
    row: css `
    label: row;
    align-items: baseline;
  `,
});
//# sourceMappingURL=NodeGraphSettings.js.map