import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useStyles2 } from '@grafana/ui';
import { PanelRenderer } from '@grafana/runtime';
import { LoadingState } from '@grafana/data';
import { RuleFormType } from '../../types/rule-form';
import { messageFromError } from '../../utils/redux';
export function PreviewRuleResult(props) {
    var preview = props.preview;
    var styles = useStyles2(getStyles);
    if (!preview) {
        return null;
    }
    var data = preview.data, ruleType = preview.ruleType;
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
            React.createElement(AutoSizer, null, function (_a) {
                var width = _a.width, height = _a.height;
                return (React.createElement("div", { style: { width: width + "px", height: height + "px" } },
                    React.createElement(PanelRenderer, { title: "", width: width, height: height, pluginId: "table", data: data })));
            }))));
}
function getStyles(theme) {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin: ", " 0;\n    "], ["\n      margin: ", " 0;\n    "])), theme.spacing(2)),
        table: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      flex: 1 1 auto;\n      height: 135px;\n      margin-top: ", ";\n      border: 1px solid ", ";\n      border-radius: ", ";\n    "], ["\n      flex: 1 1 auto;\n      height: 135px;\n      margin-top: ", ";\n      border: 1px solid ", ";\n      border-radius: ", ";\n    "])), theme.spacing(2), theme.colors.border.medium, theme.shape.borderRadius(1)),
    };
}
var templateObject_1, templateObject_2;
//# sourceMappingURL=PreviewRuleResult.js.map