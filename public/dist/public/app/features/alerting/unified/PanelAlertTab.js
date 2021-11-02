import { __assign, __rest } from "tslib";
import { Tab } from '@grafana/ui/src/components/Tabs/Tab';
import React from 'react';
import { usePanelCombinedRules } from './hooks/usePanelCombinedRules';
// it will load rule count from backend
export var PanelAlertTab = function (_a) {
    var panel = _a.panel, dashboard = _a.dashboard, otherProps = __rest(_a, ["panel", "dashboard"]);
    var _b = usePanelCombinedRules({ panel: panel, dashboard: dashboard }), rules = _b.rules, loading = _b.loading;
    return React.createElement(Tab, __assign({}, otherProps, { counter: loading ? null : rules.length }));
};
//# sourceMappingURL=PanelAlertTab.js.map