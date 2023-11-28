import { css } from '@emotion/css';
import React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FieldMatcherID, LoadingState } from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { TableCellDisplayMode, useStyles2 } from '@grafana/ui';
import { RuleFormType } from '../../types/rule-form';
import { messageFromError } from '../../utils/redux';
export function PreviewRuleResult(props) {
    const { preview } = props;
    const styles = useStyles2(getStyles);
    const fieldConfig = {
        defaults: {},
        overrides: [
            {
                matcher: { id: FieldMatcherID.byName, options: 'Info' },
                properties: [{ id: 'custom.displayMode', value: TableCellDisplayMode.JSONView }],
            },
        ],
    };
    if (!preview) {
        return null;
    }
    const { data, ruleType } = preview;
    if (data.state === LoadingState.Loading) {
        return (React.createElement("div", { className: styles.container },
            React.createElement("span", null, "Loading preview...")));
    }
    if (data.state === LoadingState.Error) {
        return (React.createElement("div", { className: styles.container }, data.error ? messageFromError(data.error) : 'Failed to preview alert rule'));
    }
    return (React.createElement("div", { className: styles.container },
        React.createElement("span", null,
            "Preview based on the result of running the query, for this moment.",
            ' ',
            ruleType === RuleFormType.grafana ? 'Configuration for `no data` and `error handling` is not applied.' : null),
        React.createElement("div", { className: styles.table },
            React.createElement(AutoSizer, null, ({ width, height }) => (React.createElement("div", { style: { width: `${width}px`, height: `${height}px` } },
                React.createElement(PanelRenderer, { title: "", width: width, height: height, pluginId: "table", data: data, fieldConfig: fieldConfig })))))));
}
function getStyles(theme) {
    return {
        container: css `
      margin: ${theme.spacing(2)} 0;
    `,
        table: css `
      flex: 1 1 auto;
      height: 135px;
      margin-top: ${theme.spacing(2)};
      border: 1px solid ${theme.colors.border.medium};
      border-radius: ${theme.shape.radius.default};
    `,
    };
}
//# sourceMappingURL=PreviewRuleResult.js.map