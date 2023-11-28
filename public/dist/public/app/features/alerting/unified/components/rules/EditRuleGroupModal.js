import { css } from '@emotion/css';
import { compact } from 'lodash';
import React, { useEffect, useMemo } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { Stack } from '@grafana/experimental';
import { Badge, Button, Field, Input, Label, LinkButton, Modal, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { useDispatch } from 'app/types';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { rulesInSameGroupHaveInvalidFor, updateLotexNamespaceAndGroupAction } from '../../state/actions';
import { checkEvaluationIntervalGlobalLimit } from '../../utils/config';
import { getRulesSourceName, GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { initialAsyncRequestState } from '../../utils/redux';
import { getAlertInfo, isRecordingRulerRule } from '../../utils/rules';
import { parsePrometheusDuration, safeParseDurationstr } from '../../utils/time';
import { DynamicTable } from '../DynamicTable';
import { EvaluationIntervalLimitExceeded } from '../InvalidIntervalWarning';
import { MIN_TIME_RANGE_STEP_S } from '../rule-editor/GrafanaEvaluationBehavior';
const ITEMS_PER_PAGE = 10;
function ForBadge({ message, error }) {
    if (error) {
        return React.createElement(Badge, { color: "red", icon: "exclamation-circle", text: 'Error', tooltip: message });
    }
    else {
        return React.createElement(Badge, { color: "orange", icon: "exclamation-triangle", text: 'Unknown', tooltip: message });
    }
}
const isValidEvaluation = (evaluation) => {
    try {
        const duration = parsePrometheusDuration(evaluation);
        if (duration < MIN_TIME_RANGE_STEP_S * 1000) {
            return false;
        }
        if (duration % (MIN_TIME_RANGE_STEP_S * 1000) !== 0) {
            return false;
        }
        return true;
    }
    catch (error) {
        return false;
    }
};
export const RulesForGroupTable = ({ rulesWithoutRecordingRules }) => {
    const styles = useStyles2(getStyles);
    const { watch } = useFormContext();
    const currentInterval = watch('groupInterval');
    const unknownCurrentInterval = !Boolean(currentInterval);
    const rows = rulesWithoutRecordingRules
        .slice()
        .map((rule, index) => ({
        id: index,
        data: getAlertInfo(rule, currentInterval),
    }))
        .sort((alert1, alert2) => safeParseDurationstr(alert1.data.forDuration) - safeParseDurationstr(alert2.data.forDuration));
    const columns = useMemo(() => {
        return [
            {
                id: 'alertName',
                label: 'Alert',
                renderCell: ({ data: { alertName } }) => {
                    return React.createElement(React.Fragment, null, alertName);
                },
                size: '330px',
            },
            {
                id: 'for',
                label: 'For',
                renderCell: ({ data: { forDuration } }) => {
                    return React.createElement(React.Fragment, null, forDuration);
                },
                size: 0.5,
            },
            {
                id: 'numberEvaluations',
                label: '#Eval',
                renderCell: ({ data: { evaluationsToFire: numberEvaluations } }) => {
                    if (unknownCurrentInterval) {
                        return React.createElement(ForBadge, { message: "#Evaluations not available." });
                    }
                    else {
                        if (!isValidEvaluation(currentInterval)) {
                            return React.createElement(ForBadge, { message: 'Invalid evaluation interval format', error: true });
                        }
                        if (numberEvaluations === 0) {
                            return (React.createElement(ForBadge, { message: "Invalid 'For' value: it should be greater or equal to evaluation interval.", error: true }));
                        }
                        else {
                            return React.createElement(React.Fragment, null, numberEvaluations);
                        }
                    }
                },
                size: 0.4,
            },
        ];
    }, [currentInterval, unknownCurrentInterval]);
    return (React.createElement("div", { className: styles.tableWrapper },
        React.createElement(DynamicTable, { items: rows, cols: columns, pagination: { itemsPerPage: ITEMS_PER_PAGE } })));
};
export const evaluateEveryValidationOptions = (rules) => ({
    required: {
        value: true,
        message: 'Required.',
    },
    validate: (evaluateEvery) => {
        try {
            const duration = parsePrometheusDuration(evaluateEvery);
            if (duration < MIN_TIME_RANGE_STEP_S * 1000) {
                return `Cannot be less than ${MIN_TIME_RANGE_STEP_S} seconds.`;
            }
            if (duration % (MIN_TIME_RANGE_STEP_S * 1000) !== 0) {
                return `Must be a multiple of ${MIN_TIME_RANGE_STEP_S} seconds.`;
            }
            if (rulesInSameGroupHaveInvalidFor(rules, evaluateEvery).length === 0) {
                return true;
            }
            else {
                return `Invalid evaluation interval. Evaluation interval should be smaller or equal to 'For' values for existing rules in this group.`;
            }
        }
        catch (error) {
            return error instanceof Error ? error.message : 'Failed to parse duration';
        }
    },
});
export function EditCloudGroupModal(props) {
    var _a, _b, _c, _d;
    const { namespace, group, onClose, intervalEditOnly } = props;
    const styles = useStyles2(getStyles);
    const dispatch = useDispatch();
    const { loading, error, dispatched } = (_a = useUnifiedAlertingSelector((state) => state.updateLotexNamespaceAndGroup)) !== null && _a !== void 0 ? _a : initialAsyncRequestState;
    const notifyApp = useAppNotification();
    const defaultValues = useMemo(() => {
        var _a;
        return ({
            namespaceName: namespace.name,
            groupName: group.name,
            groupInterval: (_a = group.interval) !== null && _a !== void 0 ? _a : '',
        });
    }, [namespace, group]);
    const rulesSourceName = getRulesSourceName(namespace.rulesSource);
    const isGrafanaManagedGroup = rulesSourceName === GRAFANA_RULES_SOURCE_NAME;
    const nameSpaceLabel = isGrafanaManagedGroup ? 'Folder' : 'Namespace';
    // close modal if successfully saved
    useEffect(() => {
        if (dispatched && !loading && !error) {
            onClose(true);
        }
    }, [dispatched, loading, onClose, error]);
    useCleanup((state) => (state.unifiedAlerting.updateLotexNamespaceAndGroup = initialAsyncRequestState));
    const onSubmit = (values) => {
        dispatch(updateLotexNamespaceAndGroupAction({
            rulesSourceName: rulesSourceName,
            groupName: group.name,
            newGroupName: values.groupName,
            namespaceName: namespace.name,
            newNamespaceName: values.namespaceName,
            groupInterval: values.groupInterval || undefined,
        }));
    };
    const formAPI = useForm({
        mode: 'onBlur',
        defaultValues,
        shouldFocusError: true,
    });
    const { handleSubmit, register, watch, formState: { isDirty, errors }, } = formAPI;
    const onInvalid = () => {
        notifyApp.error('There are errors in the form. Correct the errors and retry.');
    };
    const rulesWithoutRecordingRules = compact(group.rules.map((r) => r.rulerRule).filter((rule) => !isRecordingRulerRule(rule)));
    const hasSomeNoRecordingRules = rulesWithoutRecordingRules.length > 0;
    const modalTitle = intervalEditOnly || isGrafanaManagedGroup ? 'Edit evaluation group' : 'Edit namespace or evaluation group';
    return (React.createElement(Modal, { className: styles.modal, isOpen: true, title: modalTitle, onDismiss: onClose, onClickBackdrop: onClose },
        React.createElement(FormProvider, Object.assign({}, formAPI),
            React.createElement("form", { onSubmit: (e) => e.preventDefault(), key: JSON.stringify(defaultValues) },
                React.createElement(React.Fragment, null,
                    !props.hideFolder && (React.createElement(Field, { label: React.createElement(Label, { htmlFor: "namespaceName", description: !isGrafanaManagedGroup &&
                                'Change the current namespace name. Moving groups between namespaces is not supported' }, nameSpaceLabel), invalid: !!errors.namespaceName, error: (_b = errors.namespaceName) === null || _b === void 0 ? void 0 : _b.message },
                        React.createElement(Stack, { gap: 1, direction: "row" },
                            React.createElement(Input, Object.assign({ id: "namespaceName", readOnly: intervalEditOnly || isGrafanaManagedGroup }, register('namespaceName', {
                                required: 'Namespace name is required.',
                            }), { className: styles.formInput })),
                            isGrafanaManagedGroup && props.folderUrl && (React.createElement(LinkButton, { href: props.folderUrl, title: "Go to folder", variant: "secondary", icon: "folder-open", target: "_blank" }))))),
                    React.createElement(Field, { label: React.createElement(Label, { htmlFor: "groupName" }, "Evaluation group name"), invalid: !!errors.groupName, error: (_c = errors.groupName) === null || _c === void 0 ? void 0 : _c.message },
                        React.createElement(Input, Object.assign({ autoFocus: true, id: "groupName", readOnly: intervalEditOnly }, register('groupName', {
                            required: 'Evaluation group name is required.',
                        })))),
                    React.createElement(Field, { label: React.createElement(Label, { htmlFor: "groupInterval", description: "How often is the rule evaluated. Applies to every rule within the group." },
                            React.createElement(Stack, { gap: 0.5 }, "Evaluation interval")), invalid: !!errors.groupInterval, error: (_d = errors.groupInterval) === null || _d === void 0 ? void 0 : _d.message },
                        React.createElement(Input, Object.assign({ id: "groupInterval", placeholder: "1m" }, register('groupInterval', evaluateEveryValidationOptions(rulesWithoutRecordingRules))))),
                    checkEvaluationIntervalGlobalLimit(watch('groupInterval')).exceedsLimit && (React.createElement(EvaluationIntervalLimitExceeded, null)),
                    !hasSomeNoRecordingRules && React.createElement("div", null, "This group does not contain alert rules."),
                    hasSomeNoRecordingRules && (React.createElement(React.Fragment, null,
                        React.createElement("div", null, "List of rules that belong to this group"),
                        React.createElement("div", { className: styles.evalRequiredLabel }, "#Eval column represents the number of evaluations needed before alert starts firing."),
                        React.createElement(RulesForGroupTable, { rulesWithoutRecordingRules: rulesWithoutRecordingRules }))),
                    React.createElement("div", { className: styles.modalButtons },
                        React.createElement(Modal.ButtonRow, null,
                            React.createElement(Button, { variant: "secondary", type: "button", disabled: loading, onClick: () => onClose(false), fill: "outline" }, "Cancel"),
                            React.createElement(Button, { type: "button", disabled: !isDirty || loading, onClick: handleSubmit((values) => onSubmit(values), onInvalid) }, loading ? 'Saving...' : 'Save'))))))));
}
const getStyles = (theme) => ({
    modal: css `
    max-width: 560px;
  `,
    modalButtons: css `
    top: -24px;
    position: relative;
  `,
    formInput: css `
    flex: 1;
  `,
    tableWrapper: css `
    margin-top: ${theme.spacing(2)};
    margin-bottom: ${theme.spacing(2)};
    height: 100%;
  `,
    evalRequiredLabel: css `
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
});
//# sourceMappingURL=EditRuleGroupModal.js.map