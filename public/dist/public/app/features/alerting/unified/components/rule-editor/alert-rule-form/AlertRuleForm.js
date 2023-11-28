import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { Stack } from '@grafana/experimental';
import { config, logInfo } from '@grafana/runtime';
import { Button, ConfirmModal, CustomScrollbar, HorizontalGroup, Spinner, useStyles2 } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { useAppNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/core';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import { useDispatch, useSelector } from 'app/types';
import { LogMessages, trackNewAlerRuleFormError } from '../../../Analytics';
import { useUnifiedAlertingSelector } from '../../../hooks/useUnifiedAlertingSelector';
import { deleteRuleAction, saveRuleFormAction } from '../../../state/actions';
import { RuleFormType } from '../../../types/rule-form';
import { initialAsyncRequestState } from '../../../utils/redux';
import { formValuesFromExistingRule, getDefaultFormValues, getDefaultQueries, ignoreHiddenQueries, MINUTE, normalizeDefaultAnnotations, } from '../../../utils/rule-form';
import * as ruleId from '../../../utils/rule-id';
import { GrafanaRuleExporter } from '../../export/GrafanaRuleExporter';
import { AlertRuleNameInput } from '../AlertRuleNameInput';
import AnnotationsStep from '../AnnotationsStep';
import { CloudEvaluationBehavior } from '../CloudEvaluationBehavior';
import { GrafanaEvaluationBehavior } from '../GrafanaEvaluationBehavior';
import { NotificationsStep } from '../NotificationsStep';
import { RecordingRulesNameSpaceAndGroupStep } from '../RecordingRulesNameSpaceAndGroupStep';
import { RuleInspector } from '../RuleInspector';
import { TemplateStep } from '../TemplateStep/TemplateStep';
import { QueryAndExpressionsStep } from '../query-and-alert-condition/QueryAndExpressionsStep';
import { translateRouteParamToRuleType } from '../util';
export const AlertRuleForm = ({ existing, prefill }) => {
    var _a;
    const styles = useStyles2(getStyles);
    const dispatch = useDispatch();
    const notifyApp = useAppNotification();
    const [queryParams] = useQueryParams();
    const [showEditYaml, setShowEditYaml] = useState(false);
    const [evaluateEvery, setEvaluateEvery] = useState((_a = existing === null || existing === void 0 ? void 0 : existing.group.interval) !== null && _a !== void 0 ? _a : MINUTE);
    const { result } = useSelector(getPerconaSettings);
    const routeParams = useParams();
    const ruleType = translateRouteParamToRuleType(routeParams.type);
    const uidFromParams = routeParams.id;
    const returnTo = !queryParams['returnTo'] ? '/alerting/list' : String(queryParams['returnTo']);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const defaultValues = useMemo(() => {
        if (existing) {
            return formValuesFromExistingRule(existing);
        }
        if (prefill) {
            return formValuesFromPrefill(prefill);
        }
        if (typeof queryParams['defaults'] === 'string') {
            return formValuesFromQueryParams(queryParams['defaults'], ruleType);
        }
        const type = ruleType
            ? ruleType
            : result && !!result.alertingEnabled
                ? RuleFormType.templated
                : RuleFormType.grafana;
        return Object.assign(Object.assign({}, getDefaultFormValues()), { condition: 'C', queries: getDefaultQueries(), evaluateEvery: evaluateEvery, 
            // @PERCONA
            // Set templated as default
            type, group: result && !!result.alertingEnabled ? 'default-alert-group' : '' });
    }, [existing, prefill, queryParams, evaluateEvery, ruleType, result]);
    const formAPI = useForm({
        mode: 'onSubmit',
        defaultValues,
        shouldFocusError: true,
    });
    const { handleSubmit, watch } = formAPI;
    const type = watch('type');
    const dataSourceName = watch('dataSourceName');
    const showDataSourceDependantStep = Boolean(type && (type === RuleFormType.grafana || !!dataSourceName));
    // @PERCONA
    const showTemplateStep = type === RuleFormType.templated;
    const submitState = useUnifiedAlertingSelector((state) => state.ruleForm.saveRule) || initialAsyncRequestState;
    useCleanup((state) => (state.unifiedAlerting.ruleForm.saveRule = initialAsyncRequestState));
    const [conditionErrorMsg, setConditionErrorMsg] = useState('');
    const checkAlertCondition = (msg = '') => {
        setConditionErrorMsg(msg);
    };
    const submit = (values, exitOnSave) => {
        var _a, _b, _c, _d;
        if (conditionErrorMsg !== '') {
            notifyApp.error(conditionErrorMsg);
            return;
        }
        dispatch(saveRuleFormAction({
            values: Object.assign(Object.assign(Object.assign({}, defaultValues), values), { annotations: (_b = (_a = values.annotations) === null || _a === void 0 ? void 0 : _a.map(({ key, value }) => ({ key: key.trim(), value: value.trim() })).filter(({ key, value }) => !!key && !!value)) !== null && _b !== void 0 ? _b : [], labels: (_d = (_c = values.labels) === null || _c === void 0 ? void 0 : _c.map(({ key, value }) => ({ key: key.trim(), value: value.trim() })).filter(({ key }) => !!key)) !== null && _d !== void 0 ? _d : [] }),
            existing,
            redirectOnSave: exitOnSave ? returnTo : undefined,
            initialAlertRuleName: defaultValues.name,
            evaluateEvery: evaluateEvery,
        }));
    };
    const deleteRule = () => {
        if (existing) {
            const identifier = ruleId.fromRulerRule(existing.ruleSourceName, existing.namespace, existing.group.name, existing.rule);
            dispatch(deleteRuleAction(identifier, { navigateTo: '/alerting/list' }));
        }
    };
    const onInvalid = (errors) => {
        if (!existing) {
            trackNewAlerRuleFormError({
                grafana_version: config.buildInfo.version,
                org_id: contextSrv.user.orgId,
                user_id: contextSrv.user.id,
                error: Object.keys(errors).toString(),
            });
        }
        notifyApp.error('There are errors in the form. Please correct them and try again!');
    };
    const cancelRuleCreation = () => {
        logInfo(LogMessages.cancelSavingAlertRule);
    };
    const evaluateEveryInForm = watch('evaluateEvery');
    useEffect(() => setEvaluateEvery(evaluateEveryInForm), [evaluateEveryInForm]);
    const actionButtons = (React.createElement(HorizontalGroup, { height: "auto", justify: "flex-end" },
        existing && (React.createElement(Button, { variant: "primary", type: "button", size: "sm", onClick: handleSubmit((values) => submit(values, false), onInvalid), disabled: submitState.loading },
            submitState.loading && React.createElement(Spinner, { className: styles.buttonSpinner, inline: true }),
            "Save rule")),
        React.createElement(Button, { variant: "primary", type: "button", size: "sm", onClick: handleSubmit((values) => submit(values, true), onInvalid), disabled: submitState.loading },
            submitState.loading && React.createElement(Spinner, { className: styles.buttonSpinner, inline: true }),
            "Save rule and exit"),
        React.createElement(Link, { to: returnTo },
            React.createElement(Button, { variant: "secondary", disabled: submitState.loading, type: "button", onClick: cancelRuleCreation, size: "sm" }, "Cancel")),
        existing ? (React.createElement(Button, { fill: "outline", variant: "destructive", type: "button", onClick: () => setShowDeleteModal(true), size: "sm" }, "Delete")) : null,
        existing && isCortexLokiOrRecordingRule(watch) && (React.createElement(Button, { variant: "secondary", type: "button", onClick: () => setShowEditYaml(true), disabled: submitState.loading, size: "sm" }, "Edit YAML"))));
    return (React.createElement(FormProvider, Object.assign({}, formAPI),
        React.createElement(AppChromeUpdate, { actions: actionButtons }),
        React.createElement("form", { onSubmit: (e) => e.preventDefault(), className: styles.form },
            React.createElement("div", { className: styles.contentOuter },
                React.createElement(CustomScrollbar, { autoHeightMin: "100%", hideHorizontalTrack: true },
                    React.createElement(Stack, { direction: "column", gap: 3 },
                        React.createElement(AlertRuleNameInput, null),
                        React.createElement(QueryAndExpressionsStep, { editingExistingRule: !!existing, onDataChange: checkAlertCondition }),
                        showTemplateStep && React.createElement(TemplateStep, null),
                        showDataSourceDependantStep && (React.createElement(React.Fragment, null,
                            type === RuleFormType.grafana && (React.createElement(GrafanaEvaluationBehavior, { evaluateEvery: evaluateEvery, setEvaluateEvery: setEvaluateEvery, existing: Boolean(existing), enableProvisionedGroups: false })),
                            type === RuleFormType.cloudAlerting && React.createElement(CloudEvaluationBehavior, null),
                            type === RuleFormType.cloudRecording && React.createElement(RecordingRulesNameSpaceAndGroupStep, null),
                            type !== RuleFormType.cloudRecording && React.createElement(AnnotationsStep, null),
                            React.createElement(NotificationsStep, { alertUid: uidFromParams }))))))),
        showDeleteModal ? (React.createElement(ConfirmModal, { isOpen: true, title: "Delete rule", body: "Deleting this rule will permanently remove it. Are you sure you want to delete this rule?", confirmText: "Yes, delete", icon: "exclamation-triangle", onConfirm: deleteRule, onDismiss: () => setShowDeleteModal(false) })) : null,
        showEditYaml ? (type === RuleFormType.grafana ? (React.createElement(GrafanaRuleExporter, { alertUid: uidFromParams, onClose: () => setShowEditYaml(false) })) : (React.createElement(RuleInspector, { onClose: () => setShowEditYaml(false) }))) : null));
};
const isCortexLokiOrRecordingRule = (watch) => {
    const [ruleType, dataSourceName] = watch(['type', 'dataSourceName']);
    return (ruleType === RuleFormType.cloudAlerting || ruleType === RuleFormType.cloudRecording) && dataSourceName !== '';
};
function formValuesFromQueryParams(ruleDefinition, type) {
    var _a, _b;
    let ruleFromQueryParams;
    try {
        ruleFromQueryParams = JSON.parse(ruleDefinition);
    }
    catch (err) {
        return Object.assign(Object.assign({}, getDefaultFormValues()), { queries: getDefaultQueries() });
    }
    return ignoreHiddenQueries(Object.assign(Object.assign(Object.assign({}, getDefaultFormValues()), ruleFromQueryParams), { annotations: normalizeDefaultAnnotations((_a = ruleFromQueryParams.annotations) !== null && _a !== void 0 ? _a : []), queries: (_b = ruleFromQueryParams.queries) !== null && _b !== void 0 ? _b : getDefaultQueries(), type: type || RuleFormType.grafana, evaluateEvery: MINUTE }));
}
function formValuesFromPrefill(rule) {
    return ignoreHiddenQueries(Object.assign(Object.assign({}, getDefaultFormValues()), rule));
}
const getStyles = (theme) => ({
    buttonSpinner: css({
        marginRight: theme.spacing(1),
    }),
    form: css({
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
    }),
    contentOuter: css({
        background: theme.colors.background.primary,
        overflow: 'hidden',
        flex: 1,
    }),
    flexRow: css({
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'flex-start',
    }),
});
//# sourceMappingURL=AlertRuleForm.js.map