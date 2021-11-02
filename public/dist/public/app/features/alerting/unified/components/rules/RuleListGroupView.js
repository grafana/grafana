import { __assign, __read } from "tslib";
import React, { useMemo } from 'react';
import { isCloudRulesSource, isGrafanaRulesSource } from '../../utils/datasource';
import { CloudRules } from './CloudRules';
import { GrafanaRules } from './GrafanaRules';
export var RuleListGroupView = function (_a) {
    var namespaces = _a.namespaces, expandAll = _a.expandAll;
    var _b = __read(useMemo(function () {
        var sorted = namespaces
            .map(function (namespace) { return (__assign(__assign({}, namespace), { groups: namespace.groups.sort(function (a, b) { return a.name.localeCompare(b.name); }) })); })
            .sort(function (a, b) { return a.name.localeCompare(b.name); });
        return [
            sorted.filter(function (ns) { return isGrafanaRulesSource(ns.rulesSource); }),
            sorted.filter(function (ns) { return isCloudRulesSource(ns.rulesSource); }),
        ];
    }, [namespaces]), 2), grafanaNamespaces = _b[0], cloudNamespaces = _b[1];
    return (React.createElement(React.Fragment, null,
        React.createElement(GrafanaRules, { namespaces: grafanaNamespaces, expandAll: expandAll }),
        React.createElement(CloudRules, { namespaces: cloudNamespaces, expandAll: expandAll })));
};
//# sourceMappingURL=RuleListGroupView.js.map