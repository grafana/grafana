import { css } from '@emotion/css';
import { dump, load } from 'js-yaml';
import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Button, CodeEditor, Drawer, Icon, Tab, TabsBar, useStyles2, Tooltip } from '@grafana/ui';
import { alertingRulerRuleToRuleForm, formValuesToRulerRuleDTO, recordingRulerRuleToRuleForm, } from '../../utils/rule-form';
import { isAlertingRulerRule, isRecordingRulerRule } from '../../utils/rules';
const cloudRulesTabs = [{ label: 'Yaml', value: 'yaml' }];
export const RuleInspector = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState('yaml');
    const { setValue } = useFormContext();
    const styles = useStyles2(drawerStyles);
    const onApply = (formValues) => {
        // Need to loop through all values and set them individually
        // TODO this is not type-safe :(
        for (const key in formValues) {
            // @ts-ignore
            setValue(key, formValues[key]);
        }
        onClose();
    };
    return (React.createElement(Drawer, { title: "Inspect Alert rule", subtitle: React.createElement("div", { className: styles.subtitle },
            React.createElement(RuleInspectorTabs, { tabs: cloudRulesTabs, setActiveTab: setActiveTab, activeTab: activeTab })), onClose: onClose }, activeTab === 'yaml' && React.createElement(InspectorYamlTab, { onSubmit: onApply })));
};
export function RuleInspectorTabs({ tabs, activeTab, setActiveTab }) {
    return (React.createElement(TabsBar, null, tabs.map((tab, index) => {
        return (React.createElement(Tab, { key: `${tab.value}-${index}`, label: tab.label, value: tab.value, onChangeTab: () => setActiveTab(tab.value), active: activeTab === tab.value }));
    })));
}
const InspectorYamlTab = ({ onSubmit }) => {
    const styles = useStyles2(yamlTabStyle);
    const { getValues } = useFormContext();
    const yamlValues = formValuesToRulerRuleDTO(getValues());
    const [alertRuleAsYaml, setAlertRuleAsYaml] = useState(dump(yamlValues));
    const onApply = () => {
        const rulerRule = load(alertRuleAsYaml);
        const currentFormValues = getValues();
        const yamlFormValues = rulerRuleToRuleFormValues(rulerRule);
        onSubmit(Object.assign(Object.assign({}, currentFormValues), yamlFormValues));
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.applyButton },
            React.createElement(Button, { type: "button", onClick: onApply }, "Apply"),
            React.createElement(Tooltip, { content: React.createElement(YamlContentInfo, null), theme: "info", placement: "left-start", interactive: true },
                React.createElement(Icon, { name: "exclamation-triangle", size: "xl" }))),
        React.createElement("div", { className: styles.content },
            React.createElement(AutoSizer, { disableWidth: true }, ({ height }) => (React.createElement(CodeEditor, { width: "100%", height: height, language: "yaml", value: alertRuleAsYaml, onBlur: setAlertRuleAsYaml, monacoOptions: {
                    minimap: {
                        enabled: false,
                    },
                } }))))));
};
function YamlContentInfo() {
    return (React.createElement("div", null,
        "The YAML content in the editor only contains alert rule configuration ",
        React.createElement("br", null),
        "To configure Prometheus, you need to provide the rest of the",
        ' ',
        React.createElement("a", { href: "https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/", target: "_blank", rel: "noreferrer" }, "configuration file content.")));
}
function rulerRuleToRuleFormValues(rulerRule) {
    if (isAlertingRulerRule(rulerRule)) {
        return alertingRulerRuleToRuleForm(rulerRule);
    }
    else if (isRecordingRulerRule(rulerRule)) {
        return recordingRulerRuleToRuleForm(rulerRule);
    }
    return {};
}
export const yamlTabStyle = (theme) => ({
    content: css `
    flex-grow: 1;
    height: 100%;
    padding-bottom: 16px;
    margin-bottom: ${theme.spacing(2)};
  `,
    applyButton: css `
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    flex-grow: 0;
    margin-bottom: ${theme.spacing(2)};
  `,
});
export const drawerStyles = () => ({
    subtitle: css `
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,
});
//# sourceMappingURL=RuleInspector.js.map