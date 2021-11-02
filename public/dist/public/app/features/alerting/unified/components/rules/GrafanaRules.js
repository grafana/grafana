import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import { LoadingPlaceholder, useStyles } from '@grafana/ui';
import React from 'react';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { RulesGroup } from './RulesGroup';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { initialAsyncRequestState } from '../../utils/redux';
export var GrafanaRules = function (_a) {
    var namespaces = _a.namespaces, expandAll = _a.expandAll;
    var styles = useStyles(getStyles);
    var loading = useUnifiedAlertingSelector(function (state) { return state.promRules[GRAFANA_RULES_SOURCE_NAME] || initialAsyncRequestState; }).loading;
    return (React.createElement("section", { className: styles.wrapper },
        React.createElement("div", { className: styles.sectionHeader },
            React.createElement("h5", null, "Grafana"),
            loading ? React.createElement(LoadingPlaceholder, { className: styles.loader, text: "Loading..." }) : React.createElement("div", null)), namespaces === null || namespaces === void 0 ? void 0 :
        namespaces.map(function (namespace) {
            return namespace.groups.map(function (group) { return (React.createElement(RulesGroup, { group: group, key: namespace.name + "-" + group.name, namespace: namespace, expandAll: expandAll })); });
        }),
        (namespaces === null || namespaces === void 0 ? void 0 : namespaces.length) === 0 && React.createElement("p", null, "No rules found.")));
};
var getStyles = function (theme) { return ({
    loader: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-bottom: 0;\n  "], ["\n    margin-bottom: 0;\n  "]))),
    sectionHeader: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    display: flex;\n    justify-content: space-between;\n  "], ["\n    display: flex;\n    justify-content: space-between;\n  "]))),
    wrapper: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-bottom: ", ";\n  "], ["\n    margin-bottom: ", ";\n  "])), theme.spacing.xl),
}); };
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=GrafanaRules.js.map