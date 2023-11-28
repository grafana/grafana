import React from 'react';
import { useFormContext } from 'react-hook-form';
import { Stack } from '@grafana/experimental';
import { Icon, Text } from '@grafana/ui';
import { RuleFormType } from '../../types/rule-form';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import LabelsField from './LabelsField';
import { NeedHelpInfo } from './NeedHelpInfo';
import { RuleEditorSection } from './RuleEditorSection';
import { NotificationPreview } from './notificaton-preview/NotificationPreview';
export const NotificationsStep = ({ alertUid }) => {
    var _a;
    const { watch } = useFormContext();
    const [type, labels, queries, condition, folder, alertName] = watch([
        'type',
        'labels',
        'queries',
        'condition',
        'folder',
        'name',
    ]);
    const dataSourceName = (_a = watch('dataSourceName')) !== null && _a !== void 0 ? _a : GRAFANA_RULES_SOURCE_NAME;
    const shouldRenderPreview = type === RuleFormType.grafana;
    const NotificationsStepDescription = () => {
        return (React.createElement(Stack, { direction: "row", gap: 0.5, alignItems: "baseline" },
            React.createElement(Text, { variant: "bodySmall", color: "secondary" }, "Add custom labels to change the way your notifications are routed."),
            React.createElement(NeedHelpInfo, { contentText: React.createElement(Stack, { gap: 1 },
                    React.createElement(Stack, { direction: "row", gap: 0 },
                        React.createElement(React.Fragment, null, "Firing alert rule instances are routed to notification policies based on matching labels. All alert rules and instances, irrespective of their labels, match the default notification policy. If there are no nested policies, or no nested policies match the labels in the alert rule or alert instance, then the default notification policy is the matching policy."),
                        React.createElement("a", { href: `https://grafana.com/docs/grafana/latest/alerting/fundamentals/notification-policies/notifications/`, target: "_blank", rel: "noreferrer" },
                            React.createElement(Text, { color: "link" },
                                "Read about notification routing. ",
                                React.createElement(Icon, { name: "external-link-alt" })))),
                    React.createElement(Stack, { direction: "row", gap: 0 },
                        React.createElement(React.Fragment, null, "Custom labels change the way your notifications are routed. First, add labels to your alert rule and then connect them to your notification policy by adding label matchers."),
                        React.createElement("a", { href: `https://grafana.com/docs/grafana/latest/alerting/fundamentals/annotation-label/`, target: "_blank", rel: "noreferrer" },
                            React.createElement(Text, { color: "link" },
                                "Read about Labels and annotations. ",
                                React.createElement(Icon, { name: "external-link-alt" }))))), title: "Notification routing" })));
    };
    return (React.createElement(RuleEditorSection, { stepNo: type === RuleFormType.cloudRecording ? 4 : 5, title: type === RuleFormType.cloudRecording ? 'Add labels' : 'Configure notifications', description: React.createElement(Stack, { direction: "row", gap: 0.5, alignItems: "baseline" }, type === RuleFormType.cloudRecording ? (React.createElement(Text, { variant: "bodySmall", color: "secondary" }, "Add labels to help you better manage your recording rules")) : (React.createElement(NotificationsStepDescription, null))), fullWidth: true },
        React.createElement(LabelsField, { dataSourceName: dataSourceName }),
        shouldRenderPreview && (React.createElement(NotificationPreview, { alertQueries: queries, customLabels: labels, condition: condition, folder: folder, alertName: alertName, alertUid: alertUid }))));
};
//# sourceMappingURL=NotificationsStep.js.map