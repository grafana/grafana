import { __rest } from "tslib";
import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Stack } from '@grafana/experimental';
import { Field, Icon, IconButton, Input, InputControl, Label, Switch, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { logInfo, LogMessages } from '../../Analytics';
import { useCombinedRuleNamespaces } from '../../hooks/useCombinedRuleNamespaces';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { parsePrometheusDuration } from '../../utils/time';
import { CollapseToggle } from '../CollapseToggle';
import { EditCloudGroupModal } from '../rules/EditRuleGroupModal';
import { FolderAndGroup, useFolderGroupOptions } from './FolderAndGroup';
import { GrafanaAlertStatePicker } from './GrafanaAlertStatePicker';
import { NeedHelpInfo } from './NeedHelpInfo';
import { RuleEditorSection } from './RuleEditorSection';
export const MIN_TIME_RANGE_STEP_S = 10; // 10 seconds
const forValidationOptions = (evaluateEvery) => ({
    required: {
        value: true,
        message: 'Required.',
    },
    validate: (value) => {
        // parsePrometheusDuration does not allow 0 but does allow 0s
        if (value === '0') {
            return true;
        }
        try {
            const millisFor = parsePrometheusDuration(value);
            // 0 is a special value meaning for equals evaluation interval
            if (millisFor === 0) {
                return true;
            }
            try {
                const millisEvery = parsePrometheusDuration(evaluateEvery);
                return millisFor >= millisEvery
                    ? true
                    : 'For duration must be greater than or equal to the evaluation interval.';
            }
            catch (err) {
                // if we fail to parse "every", assume validation is successful, or the error messages
                // will overlap in the UI
                return true;
            }
        }
        catch (error) {
            return error instanceof Error ? error.message : 'Failed to parse duration';
        }
    },
});
const useIsNewGroup = (folder, group) => {
    const { groupOptions } = useFolderGroupOptions(folder, false);
    const groupIsInGroupOptions = useCallback((group_) => groupOptions.some((groupInList) => groupInList.label === group_), [groupOptions]);
    return !groupIsInGroupOptions(group);
};
function FolderGroupAndEvaluationInterval({ evaluateEvery, setEvaluateEvery, enableProvisionedGroups, }) {
    const styles = useStyles2(getStyles);
    const { watch, setValue, getValues } = useFormContext();
    const [isEditingGroup, setIsEditingGroup] = useState(false);
    const [groupName, folderName] = watch(['group', 'folder.title']);
    const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
    const groupfoldersForGrafana = rulerRuleRequests[GRAFANA_RULES_SOURCE_NAME];
    const grafanaNamespaces = useCombinedRuleNamespaces(GRAFANA_RULES_SOURCE_NAME);
    const existingNamespace = grafanaNamespaces.find((ns) => ns.name === folderName);
    const existingGroup = existingNamespace === null || existingNamespace === void 0 ? void 0 : existingNamespace.groups.find((g) => g.name === groupName);
    const isNewGroup = useIsNewGroup(folderName !== null && folderName !== void 0 ? folderName : '', groupName);
    useEffect(() => {
        if (!isNewGroup && (existingGroup === null || existingGroup === void 0 ? void 0 : existingGroup.interval)) {
            setEvaluateEvery(existingGroup.interval);
        }
    }, [setEvaluateEvery, isNewGroup, setValue, existingGroup]);
    const closeEditGroupModal = (saved = false) => {
        if (!saved) {
            logInfo(LogMessages.leavingRuleGroupEdit);
        }
        setIsEditingGroup(false);
    };
    const onOpenEditGroupModal = () => setIsEditingGroup(true);
    const editGroupDisabled = (groupfoldersForGrafana === null || groupfoldersForGrafana === void 0 ? void 0 : groupfoldersForGrafana.loading) || isNewGroup || !folderName || !groupName;
    const emptyNamespace = {
        name: folderName,
        rulesSource: GRAFANA_RULES_SOURCE_NAME,
        groups: [],
    };
    const emptyGroup = { name: groupName, interval: evaluateEvery, rules: [], totals: {} };
    return (React.createElement("div", null,
        React.createElement(FolderAndGroup, { groupfoldersForGrafana: groupfoldersForGrafana === null || groupfoldersForGrafana === void 0 ? void 0 : groupfoldersForGrafana.result, enableProvisionedGroups: enableProvisionedGroups }),
        folderName && isEditingGroup && (React.createElement(EditCloudGroupModal, { namespace: existingNamespace !== null && existingNamespace !== void 0 ? existingNamespace : emptyNamespace, group: existingGroup !== null && existingGroup !== void 0 ? existingGroup : emptyGroup, onClose: () => closeEditGroupModal(), intervalEditOnly: true, hideFolder: true })),
        folderName && groupName && (React.createElement("div", { className: styles.evaluationContainer },
            React.createElement(Stack, { direction: "column", gap: 0 },
                React.createElement("div", { className: styles.marginTop },
                    React.createElement(Stack, { direction: "column", gap: 1 }, getValues('group') && getValues('evaluateEvery') && (React.createElement("span", null,
                        "All rules in the selected group are evaluated every ",
                        evaluateEvery,
                        ".",
                        ' ',
                        !isNewGroup && (React.createElement(IconButton, { name: "pen", "aria-label": "Edit", disabled: editGroupDisabled, onClick: onOpenEditGroupModal })))))))))));
}
function ForInput({ evaluateEvery }) {
    var _a, _b;
    const styles = useStyles2(getStyles);
    const { register, formState: { errors }, } = useFormContext();
    const evaluateForId = 'eval-for-input';
    return (React.createElement(Stack, { direction: "row", "justify-content": "flex-start", "align-items": "flex-start" },
        React.createElement(Field, { label: React.createElement(Label, { htmlFor: "evaluateFor", description: "Period in which an alert rule can be in breach of the condition until the alert rule fires." }, "Pending period"), className: styles.inlineField, error: (_a = errors.evaluateFor) === null || _a === void 0 ? void 0 : _a.message, invalid: !!((_b = errors.evaluateFor) === null || _b === void 0 ? void 0 : _b.message), validationMessageHorizontalOverflow: true },
            React.createElement(Input, Object.assign({ id: evaluateForId, width: 8 }, register('evaluateFor', forValidationOptions(evaluateEvery)))))));
}
function getDescription() {
    const docsLink = 'https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rules/rule-evaluation/';
    return (React.createElement(Stack, { direction: "row", gap: 0.5, alignItems: "baseline" },
        React.createElement(Text, { variant: "bodySmall", color: "secondary" }, "Define how the alert rule is evaluated."),
        React.createElement(NeedHelpInfo, { contentText: "Evaluation groups are containers for evaluating alert and recording rules. An evaluation group defines an evaluation interval - how often a rule is checked. Alert rules within the same evaluation group are evaluated sequentially", externalLink: docsLink, linkText: `Read about evaluation`, title: "Evaluation" })));
}
export function GrafanaEvaluationBehavior({ evaluateEvery, setEvaluateEvery, existing, enableProvisionedGroups, }) {
    const styles = useStyles2(getStyles);
    const [showErrorHandling, setShowErrorHandling] = useState(false);
    const { watch, setValue } = useFormContext();
    const isPaused = watch('isPaused');
    return (
    // TODO remove "and alert condition" for recording rules
    React.createElement(RuleEditorSection, { stepNo: 3, title: "Set evaluation behavior", description: getDescription() },
        React.createElement(Stack, { direction: "column", "justify-content": "flex-start", "align-items": "flex-start" },
            React.createElement(FolderGroupAndEvaluationInterval, { setEvaluateEvery: setEvaluateEvery, evaluateEvery: evaluateEvery, enableProvisionedGroups: enableProvisionedGroups }),
            React.createElement(ForInput, { evaluateEvery: evaluateEvery }),
            existing && (React.createElement(Field, { htmlFor: "pause-alert-switch" },
                React.createElement(InputControl, { render: () => (React.createElement(Stack, { gap: 1, direction: "row", alignItems: "center" },
                        React.createElement(Switch, { id: "pause-alert", onChange: (value) => {
                                setValue('isPaused', value.currentTarget.checked);
                            }, value: Boolean(isPaused) }),
                        React.createElement("label", { htmlFor: "pause-alert", className: styles.switchLabel },
                            "Pause evaluation",
                            React.createElement(Tooltip, { placement: "top", content: "Turn on to pause evaluation for this alert rule.", theme: 'info' },
                                React.createElement(Icon, { tabIndex: 0, name: "info-circle", size: "sm", className: styles.infoIcon }))))), name: "isPaused" })))),
        React.createElement(CollapseToggle, { isCollapsed: !showErrorHandling, onToggle: (collapsed) => setShowErrorHandling(!collapsed), text: "Configure no data and error handling" }),
        showErrorHandling && (React.createElement(React.Fragment, null,
            React.createElement(Field, { htmlFor: "no-data-state-input", label: "Alert state if no data or all values are null" },
                React.createElement(InputControl, { render: (_a) => {
                        var _b = _a.field, { onChange, ref } = _b, field = __rest(_b, ["onChange", "ref"]);
                        return (React.createElement(GrafanaAlertStatePicker, Object.assign({}, field, { inputId: "no-data-state-input", width: 42, includeNoData: true, includeError: false, onChange: (value) => onChange(value === null || value === void 0 ? void 0 : value.value) })));
                    }, name: "noDataState" })),
            React.createElement(Field, { htmlFor: "exec-err-state-input", label: "Alert state if execution error or timeout" },
                React.createElement(InputControl, { render: (_a) => {
                        var _b = _a.field, { onChange, ref } = _b, field = __rest(_b, ["onChange", "ref"]);
                        return (React.createElement(GrafanaAlertStatePicker, Object.assign({}, field, { inputId: "exec-err-state-input", width: 42, includeNoData: false, includeError: true, onChange: (value) => onChange(value === null || value === void 0 ? void 0 : value.value) })));
                    }, name: "execErrState" }))))));
}
const getStyles = (theme) => ({
    inlineField: css `
    margin-bottom: 0;
  `,
    evaluateLabel: css `
    margin-right: ${theme.spacing(1)};
  `,
    evaluationContainer: css `
    color: ${theme.colors.text.secondary};
    max-width: ${theme.breakpoints.values.sm}px;
    font-size: ${theme.typography.size.sm};
  `,
    intervalChangedLabel: css `
    margin-bottom: ${theme.spacing(1)};
  `,
    warningIcon: css `
    justify-self: center;
    margin-right: ${theme.spacing(1)};
    color: ${theme.colors.warning.text};
  `,
    infoIcon: css `
    margin-left: 10px;
  `,
    warningMessage: css `
    color: ${theme.colors.warning.text};
  `,
    bold: css `
    font-weight: bold;
  `,
    alignInterval: css `
    margin-top: ${theme.spacing(1)};
    margin-left: -${theme.spacing(1)};
  `,
    marginTop: css `
    margin-top: ${theme.spacing(1)};
  `,
    switchLabel: css(`
    color: ${theme.colors.text.primary},
    cursor: 'pointer',
    fontSize: ${theme.typography.bodySmall.fontSize},
  `),
});
//# sourceMappingURL=GrafanaEvaluationBehavior.js.map