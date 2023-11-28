import { __rest } from "tslib";
import React from 'react';
import { Tab } from '@grafana/ui/src/components/Tabs/Tab';
import { usePanelCombinedRules } from './hooks/usePanelCombinedRules';
// it will load rule count from backend
export const PanelAlertTab = (_a) => {
    var { panel, dashboard } = _a, otherProps = __rest(_a, ["panel", "dashboard"]);
    const { rules, loading } = usePanelCombinedRules({ panel, dashboard });
    return React.createElement(Tab, Object.assign({}, otherProps, { counter: loading ? null : rules.length }));
};
//# sourceMappingURL=PanelAlertTab.js.map