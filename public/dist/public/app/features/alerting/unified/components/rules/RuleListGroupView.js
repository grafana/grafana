import React, { useEffect, useMemo } from 'react';
import { logInfo } from '@grafana/runtime';
import { LogMessages } from '../../Analytics';
import { AlertSourceAction } from '../../hooks/useAbilities';
import { isCloudRulesSource, isGrafanaRulesSource } from '../../utils/datasource';
import { Authorize } from '../Authorize';
import { CloudRules } from './CloudRules';
import { GrafanaRules } from './GrafanaRules';
export const RuleListGroupView = ({ namespaces, expandAll }) => {
    const [grafanaNamespaces, cloudNamespaces] = useMemo(() => {
        const sorted = namespaces
            .map((namespace) => (Object.assign(Object.assign({}, namespace), { groups: namespace.groups.sort((a, b) => a.name.localeCompare(b.name)) })))
            .sort((a, b) => a.name.localeCompare(b.name));
        return [
            sorted.filter((ns) => isGrafanaRulesSource(ns.rulesSource)),
            sorted.filter((ns) => isCloudRulesSource(ns.rulesSource)),
        ];
    }, [namespaces]);
    useEffect(() => {
        logInfo(LogMessages.loadedList);
    }, []);
    return (React.createElement(React.Fragment, null,
        React.createElement(Authorize, { actions: [AlertSourceAction.ViewAlertRule] },
            React.createElement(GrafanaRules, { namespaces: grafanaNamespaces, expandAll: expandAll })),
        React.createElement(Authorize, { actions: [AlertSourceAction.ViewExternalAlertRule] },
            React.createElement(CloudRules, { namespaces: cloudNamespaces, expandAll: expandAll }))));
};
//# sourceMappingURL=RuleListGroupView.js.map