import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import { LoadingPlaceholder, useStyles } from '@grafana/ui';
import React, { useMemo } from 'react';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { RulesGroup } from './RulesGroup';
import { getRulesDataSources, getRulesSourceName } from '../../utils/datasource';
import pluralize from 'pluralize';
export var CloudRules = function (_a) {
    var namespaces = _a.namespaces, expandAll = _a.expandAll;
    var styles = useStyles(getStyles);
    var rules = useUnifiedAlertingSelector(function (state) { return state.promRules; });
    var rulesDataSources = useMemo(getRulesDataSources, []);
    var dataSourcesLoading = useMemo(function () { return rulesDataSources.filter(function (ds) { var _a; return (_a = rules[ds.name]) === null || _a === void 0 ? void 0 : _a.loading; }); }, [
        rules,
        rulesDataSources,
    ]);
    return (React.createElement("section", { className: styles.wrapper },
        React.createElement("div", { className: styles.sectionHeader },
            React.createElement("h5", null, "Cortex / Loki"),
            dataSourcesLoading.length ? (React.createElement(LoadingPlaceholder, { className: styles.loader, text: "Loading rules from " + dataSourcesLoading.length + " " + pluralize('source', dataSourcesLoading.length) })) : (React.createElement("div", null))),
        namespaces.map(function (namespace) {
            var groups = namespace.groups, rulesSource = namespace.rulesSource;
            return groups.map(function (group) { return (React.createElement(RulesGroup, { group: group, key: getRulesSourceName(rulesSource) + "-" + name + "-" + group.name, namespace: namespace, expandAll: expandAll })); });
        }),
        (namespaces === null || namespaces === void 0 ? void 0 : namespaces.length) === 0 && !!rulesDataSources.length && React.createElement("p", null, "No rules found."),
        !rulesDataSources.length && React.createElement("p", null, "There are no Prometheus or Loki datas sources configured.")));
};
var getStyles = function (theme) { return ({
    loader: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-bottom: 0;\n  "], ["\n    margin-bottom: 0;\n  "]))),
    sectionHeader: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    display: flex;\n    justify-content: space-between;\n  "], ["\n    display: flex;\n    justify-content: space-between;\n  "]))),
    wrapper: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-bottom: ", ";\n  "], ["\n    margin-bottom: ", ";\n  "])), theme.spacing.xl),
}); };
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=CloudRules.js.map