import React, { useMemo, useState } from 'react';
import { Stack } from '@grafana/experimental';
import { Alert, Button, Icon, LoadingPlaceholder, Tab, TabContent, TabsBar, Text } from '@grafana/ui';
import { GrafanaAlertState } from 'app/types/unified-alerting-dto';
import { useRuleViewerPageTitle } from '../../../hooks/alert-details/useRuleViewerPageTitle';
import { useCombinedRule } from '../../../hooks/useCombinedRule';
import * as ruleId from '../../../utils/rule-id';
import { isAlertingRule, isFederatedRuleGroup, isGrafanaRulerRule } from '../../../utils/rules';
import { AlertStateDot } from '../../AlertStateDot';
import { ProvisionedResource, ProvisioningAlert } from '../../Provisioning';
import { Spacer } from '../../Spacer';
import { History } from '../tabs/History';
import { InstancesList } from '../tabs/Instances';
import { QueryResults } from '../tabs/Query';
import { Routing } from '../tabs/Routing';
var Tabs;
(function (Tabs) {
    Tabs[Tabs["Instances"] = 0] = "Instances";
    Tabs[Tabs["Query"] = 1] = "Query";
    Tabs[Tabs["Routing"] = 2] = "Routing";
    Tabs[Tabs["History"] = 3] = "History";
})(Tabs || (Tabs = {}));
// @TODO
// hook up tabs to query params or path segment
// figure out why we needed <AlertingPageWrapper>
// add provisioning and federation stuff back in
const RuleViewer = ({ match }) => {
    var _a;
    const { id } = match.params;
    const [activeTab, setActiveTab] = useState(Tabs.Instances);
    const identifier = useMemo(() => {
        if (!id) {
            throw new Error('Rule ID is required');
        }
        return ruleId.parse(id, true);
    }, [id]);
    const { loading, error, result: rule } = useCombinedRule({ ruleIdentifier: identifier });
    // we're setting the document title and the breadcrumb manually
    useRuleViewerPageTitle(rule);
    if (loading) {
        return React.createElement(LoadingPlaceholder, { text: 'Loading...' });
    }
    if (error) {
        return String(error);
    }
    if (rule) {
        const summary = rule.annotations['summary'];
        const promRule = rule.promRule;
        const isAlertType = isAlertingRule(promRule);
        const numberOfInstance = isAlertType ? (_a = promRule.alerts) === null || _a === void 0 ? void 0 : _a.length : undefined;
        const isFederatedRule = isFederatedRuleGroup(rule.group);
        const isProvisioned = isGrafanaRulerRule(rule.rulerRule) && Boolean(rule.rulerRule.grafana_alert.provenance);
        return (React.createElement(React.Fragment, null,
            React.createElement(Stack, { direction: "column", gap: 3 },
                React.createElement(Stack, null,
                    React.createElement(BreadCrumb, { folder: rule.namespace.name, evaluationGroup: rule.group.name }),
                    React.createElement(Spacer, null),
                    React.createElement(Stack, { gap: 1 },
                        React.createElement(Button, { variant: "secondary", icon: "pen" }, "Edit"),
                        React.createElement(Button, { variant: "secondary" },
                            React.createElement(Stack, { alignItems: "center", gap: 1 },
                                "More ",
                                React.createElement(Icon, { name: "angle-down" }))))),
                React.createElement(Stack, { direction: "column", gap: 1 },
                    React.createElement(Stack, { alignItems: "center" },
                        React.createElement(Title, { name: rule.name, state: GrafanaAlertState.Alerting })),
                    summary && React.createElement(Summary, { text: summary })),
                isFederatedRule && (React.createElement(Alert, { severity: "info", title: "This rule is part of a federated rule group." },
                    React.createElement(Stack, { direction: "column" },
                        "Federated rule groups are currently an experimental feature.",
                        React.createElement(Button, { fill: "text", icon: "book" },
                            React.createElement("a", { href: "https://grafana.com/docs/metrics-enterprise/latest/tenant-management/tenant-federation/#cross-tenant-alerting-and-recording-rule-federation" }, "Read documentation"))))),
                isProvisioned && React.createElement(ProvisioningAlert, { resource: ProvisionedResource.AlertRule }),
                React.createElement(TabsBar, null,
                    React.createElement(Tab, { label: "Instances", active: true, counter: numberOfInstance, onChangeTab: () => setActiveTab(Tabs.Instances) }),
                    React.createElement(Tab, { label: "Query", onChangeTab: () => setActiveTab(Tabs.Query) }),
                    React.createElement(Tab, { label: "Routing", onChangeTab: () => setActiveTab(Tabs.Routing) }),
                    React.createElement(Tab, { label: "History", onChangeTab: () => setActiveTab(Tabs.History) })),
                React.createElement(TabContent, null,
                    activeTab === Tabs.Instances && React.createElement(InstancesList, null),
                    activeTab === Tabs.Query && React.createElement(QueryResults, null),
                    activeTab === Tabs.Routing && React.createElement(Routing, null),
                    activeTab === Tabs.History && React.createElement(History, null)))));
    }
    return null;
};
const BreadCrumb = ({ folder, evaluationGroup }) => (React.createElement(Stack, { alignItems: "center", gap: 0.5 },
    React.createElement(Text, { color: "secondary" },
        React.createElement(Icon, { name: "folder" })),
    React.createElement(Text, { variant: "body", color: "primary" }, folder),
    React.createElement(Text, { variant: "body", color: "secondary" },
        React.createElement(Icon, { name: "angle-right" })),
    React.createElement(Text, { variant: "body", color: "primary" }, evaluationGroup)));
const Title = ({ name, state }) => (React.createElement("header", null,
    React.createElement(Stack, { alignItems: 'center', gap: 1 },
        React.createElement(AlertStateDot, { size: "md", state: state }),
        React.createElement(Text, { element: "h1", variant: "h2", weight: "bold" }, name))));
const Summary = ({ text }) => (React.createElement(Text, { variant: "body", color: "secondary" }, text));
export default RuleViewer;
//# sourceMappingURL=RuleViewer.v2.js.map