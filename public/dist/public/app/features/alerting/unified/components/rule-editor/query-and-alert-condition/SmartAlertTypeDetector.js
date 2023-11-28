import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Stack } from '@grafana/experimental';
import { RadioButtonGroup, Text } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { ExpressionDatasourceUID } from 'app/features/expressions/types';
import { AccessControlAction } from 'app/types';
import { RuleFormType } from '../../../types/rule-form';
import { NeedHelpInfo } from '../NeedHelpInfo';
function getAvailableRuleTypes() {
    const canCreateGrafanaRules = contextSrv.hasPermission(AccessControlAction.AlertingRuleCreate);
    const canCreateCloudRules = contextSrv.hasPermission(AccessControlAction.AlertingRuleExternalWrite);
    const defaultRuleType = canCreateGrafanaRules ? RuleFormType.grafana : RuleFormType.cloudAlerting;
    const enabledRuleTypes = [];
    if (canCreateGrafanaRules) {
        enabledRuleTypes.push(RuleFormType.grafana);
    }
    if (canCreateCloudRules) {
        enabledRuleTypes.push(RuleFormType.cloudAlerting, RuleFormType.cloudRecording);
    }
    return { enabledRuleTypes, defaultRuleType };
}
const onlyOneDSInQueries = (queries) => {
    return queries.filter((q) => q.datasourceUid !== ExpressionDatasourceUID).length === 1;
};
const getCanSwitch = ({ queries, ruleFormType, rulesSourcesWithRuler, }) => {
    var _a, _b;
    // get available rule types
    const availableRuleTypes = getAvailableRuleTypes();
    // check if we have only one query in queries and if it's a cloud datasource
    const onlyOneDS = onlyOneDSInQueries(queries);
    const dataSourceIdFromQueries = (_b = (_a = queries[0]) === null || _a === void 0 ? void 0 : _a.datasourceUid) !== null && _b !== void 0 ? _b : '';
    const isRecordingRuleType = ruleFormType === RuleFormType.cloudRecording;
    //let's check if we switch to cloud type
    const canSwitchToCloudRule = !isRecordingRuleType &&
        onlyOneDS &&
        rulesSourcesWithRuler.some((dsJsonData) => dsJsonData.uid === dataSourceIdFromQueries);
    const canSwitchToGrafanaRule = !isRecordingRuleType;
    // check for enabled types
    const grafanaTypeEnabled = availableRuleTypes.enabledRuleTypes.includes(RuleFormType.grafana);
    const cloudTypeEnabled = availableRuleTypes.enabledRuleTypes.includes(RuleFormType.cloudAlerting);
    // can we switch to the other type? (cloud or grafana)
    const canSwitchFromCloudToGrafana = ruleFormType === RuleFormType.cloudAlerting && grafanaTypeEnabled && canSwitchToGrafanaRule;
    const canSwitchFromGrafanaToCloud = ruleFormType === RuleFormType.grafana && canSwitchToCloudRule && cloudTypeEnabled && canSwitchToCloudRule;
    return canSwitchFromCloudToGrafana || canSwitchFromGrafanaToCloud;
};
export function SmartAlertTypeDetector({ editingExistingRule, rulesSourcesWithRuler, queries, onClickSwitch, }) {
    const { getValues } = useFormContext();
    const [ruleFormType] = getValues(['type']);
    const canSwitch = getCanSwitch({ queries, ruleFormType, rulesSourcesWithRuler });
    console.log(ruleFormType);
    const options = [
        { label: 'Grafana-managed', value: RuleFormType.grafana },
        { label: 'Data source-managed', value: RuleFormType.cloudAlerting },
    ];
    // if we can't switch to data-source managed, disable it
    // TODO figure out how to show a popover to the user to indicate _why_ it's disabled
    const disabledOptions = canSwitch ? [] : [RuleFormType.cloudAlerting];
    return (React.createElement(Stack, { direction: "column", gap: 1, alignItems: "flex-start" },
        React.createElement(Stack, { direction: "column", gap: 0 },
            React.createElement(Text, { variant: "h5" }, "Rule type"),
            React.createElement(Stack, { direction: "row", gap: 0.5, alignItems: "baseline" },
                React.createElement(Text, { variant: "bodySmall", color: "secondary" }, "Select where the alert rule will be managed."),
                React.createElement(NeedHelpInfo, { contentText: React.createElement(React.Fragment, null,
                        React.createElement(Text, { color: "primary", variant: "h6" }, "Grafana-managed alert rules"),
                        React.createElement("p", null, "Grafana-managed alert rules allow you to create alerts that can act on data from any of our supported data sources, including having multiple data sources in the same rule. You can also add expressions to transform your data and set alert conditions. Using images in alert notifications is also supported."),
                        React.createElement(Text, { color: "primary", variant: "h6" }, "Data source-managed alert rules"),
                        React.createElement("p", null, "Data source-managed alert rules can be used for Grafana Mimir or Grafana Loki data sources which have been configured to support rule creation. The use of expressions or multiple queries is not supported.")), externalLink: "https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/alert-rule-types/", linkText: "Read about alert rule types", title: "Alert rule types" }))),
        React.createElement(RadioButtonGroup, { options: options, disabled: editingExistingRule, disabledOptions: disabledOptions, value: ruleFormType, onChange: onClickSwitch }),
        editingExistingRule && (React.createElement(Text, { color: "secondary" }, "The alert rule type cannot be changed for an existing rule.")),
        !editingExistingRule && (React.createElement(React.Fragment, null, canSwitch ? (React.createElement(Text, { color: "secondary" }, ruleFormType === RuleFormType.grafana
            ? 'The data source selected in your query supports alert rule management. Switch to data source-managed if you want the alert rule to be managed by the data source instead of Grafana.'
            : 'Switch to Grafana-managed to use expressions, multiple queries, images in notifications and various other features.')) : (React.createElement(Text, { color: "secondary" }, "Based on the selected data sources this alert rule will be Grafana-managed."))))));
}
//# sourceMappingURL=SmartAlertTypeDetector.js.map