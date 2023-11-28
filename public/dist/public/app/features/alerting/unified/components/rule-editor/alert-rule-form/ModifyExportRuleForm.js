import { __awaiter } from "tslib";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useAsync } from 'react-use';
import { Stack } from '@grafana/experimental';
import { Button, CustomScrollbar, LinkButton, LoadingPlaceholder } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { AppChromeUpdate } from '../../../../../../core/components/AppChrome/AppChromeUpdate';
import { alertRuleApi } from '../../../api/alertRuleApi';
import { fetchRulerRulesGroup } from '../../../api/ruler';
import { useDataSourceFeatures } from '../../../hooks/useCombinedRule';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { formValuesToRulerGrafanaRuleDTO, MINUTE } from '../../../utils/rule-form';
import { isGrafanaRulerRule } from '../../../utils/rules';
import { FileExportPreview } from '../../export/FileExportPreview';
import { GrafanaExportDrawer } from '../../export/GrafanaExportDrawer';
import { allGrafanaExportProviders } from '../../export/providers';
import { AlertRuleNameInput } from '../AlertRuleNameInput';
import AnnotationsStep from '../AnnotationsStep';
import { GrafanaEvaluationBehavior } from '../GrafanaEvaluationBehavior';
import { NotificationsStep } from '../NotificationsStep';
import { QueryAndExpressionsStep } from '../query-and-alert-condition/QueryAndExpressionsStep';
export function ModifyExportRuleForm({ ruleForm, alertUid }) {
    var _a;
    const formAPI = useForm({
        mode: 'onSubmit',
        defaultValues: ruleForm,
        shouldFocusError: true,
    });
    const [queryParams] = useQueryParams();
    const existing = Boolean(ruleForm); // always should be true
    const notifyApp = useAppNotification();
    const returnTo = !queryParams['returnTo'] ? '/alerting/list' : String(queryParams['returnTo']);
    const [exportData, setExportData] = useState(undefined);
    const [conditionErrorMsg, setConditionErrorMsg] = useState('');
    const [evaluateEvery, setEvaluateEvery] = useState((_a = ruleForm === null || ruleForm === void 0 ? void 0 : ruleForm.evaluateEvery) !== null && _a !== void 0 ? _a : MINUTE);
    const checkAlertCondition = (msg = '') => {
        setConditionErrorMsg(msg);
    };
    const submit = (exportData) => {
        if (conditionErrorMsg !== '') {
            notifyApp.error(conditionErrorMsg);
            return;
        }
        setExportData(exportData);
    };
    const onClose = useCallback(() => {
        setExportData(undefined);
    }, [setExportData]);
    const actionButtons = [
        React.createElement(LinkButton, { href: returnTo, key: "cancel", size: "sm", variant: "secondary", onClick: () => submit(undefined) }, "Cancel"),
        React.createElement(Button, { key: "export-rule", size: "sm", onClick: formAPI.handleSubmit((formValues) => submit(formValues)) }, "Export"),
    ];
    return (React.createElement(React.Fragment, null,
        React.createElement(FormProvider, Object.assign({}, formAPI),
            React.createElement(AppChromeUpdate, { actions: actionButtons }),
            React.createElement("form", { onSubmit: (e) => e.preventDefault() },
                React.createElement("div", null,
                    React.createElement(CustomScrollbar, { autoHeightMin: "100%", hideHorizontalTrack: true },
                        React.createElement(Stack, { direction: "column", gap: 3 },
                            React.createElement(AlertRuleNameInput, null),
                            React.createElement(QueryAndExpressionsStep, { editingExistingRule: existing, onDataChange: checkAlertCondition }),
                            React.createElement(GrafanaEvaluationBehavior, { evaluateEvery: evaluateEvery, setEvaluateEvery: setEvaluateEvery, existing: Boolean(existing), enableProvisionedGroups: true }),
                            React.createElement(AnnotationsStep, null),
                            React.createElement(NotificationsStep, { alertUid: alertUid }))))),
            exportData && React.createElement(GrafanaRuleDesignExporter, { exportValues: exportData, onClose: onClose, uid: alertUid }))));
}
const useGetGroup = (nameSpace, group) => {
    const { dsFeatures } = useDataSourceFeatures(GRAFANA_RULES_SOURCE_NAME);
    const rulerConfig = dsFeatures === null || dsFeatures === void 0 ? void 0 : dsFeatures.rulerConfig;
    const targetGroup = useAsync(() => __awaiter(void 0, void 0, void 0, function* () {
        return rulerConfig ? yield fetchRulerRulesGroup(rulerConfig, nameSpace, group) : undefined;
    }), [rulerConfig, nameSpace, group]);
    return targetGroup;
};
export const getPayloadToExport = (uid, formValues, existingGroup) => {
    var _a;
    const grafanaRuleDto = formValuesToRulerGrafanaRuleDTO(formValues);
    const updatedRule = Object.assign(Object.assign({}, grafanaRuleDto), { grafana_alert: Object.assign(Object.assign({}, grafanaRuleDto.grafana_alert), { uid: uid }) });
    if (existingGroup === null || existingGroup === void 0 ? void 0 : existingGroup.rules) {
        // we have to update the rule in the group in the same position if it exists, otherwise we have to add it at the end
        let alreadyExistsInGroup = false;
        const updatedRules = existingGroup.rules.map((rule) => {
            if (isGrafanaRulerRule(rule) && rule.grafana_alert.uid === uid) {
                alreadyExistsInGroup = true;
                return updatedRule;
            }
            else {
                return rule;
            }
        });
        if (!alreadyExistsInGroup) {
            // we have to add the updated rule at the end of the group
            updatedRules.push(updatedRule);
        }
        return Object.assign(Object.assign({}, existingGroup), { rules: updatedRules });
    }
    else {
        // we have to create a new group with the updated rule
        return {
            name: (_a = existingGroup === null || existingGroup === void 0 ? void 0 : existingGroup.name) !== null && _a !== void 0 ? _a : '',
            rules: [updatedRule],
        };
    }
};
const useGetPayloadToExport = (values, uid) => {
    var _a, _b;
    const rulerGroupDto = useGetGroup((_b = (_a = values.folder) === null || _a === void 0 ? void 0 : _a.title) !== null && _b !== void 0 ? _b : '', values.group);
    const payload = useMemo(() => {
        return getPayloadToExport(uid, values, rulerGroupDto === null || rulerGroupDto === void 0 ? void 0 : rulerGroupDto.value);
    }, [uid, rulerGroupDto, values]);
    return { payload, loadingGroup: rulerGroupDto.loading };
};
const GrafanaRuleDesignExportPreview = ({ exportFormat, exportValues, onClose, uid, }) => {
    var _a, _b, _c;
    const [getExport, exportData] = alertRuleApi.endpoints.exportModifiedRuleGroup.useMutation();
    const { loadingGroup, payload } = useGetPayloadToExport(exportValues, uid);
    const nameSpace = (_b = (_a = exportValues.folder) === null || _a === void 0 ? void 0 : _a.title) !== null && _b !== void 0 ? _b : '';
    useEffect(() => {
        !loadingGroup && getExport({ payload, format: exportFormat, nameSpace: nameSpace });
    }, [nameSpace, exportFormat, payload, getExport, loadingGroup]);
    if (exportData.isLoading) {
        return React.createElement(LoadingPlaceholder, { text: "Loading...." });
    }
    const downloadFileName = `modify-export-${payload.name}-${uid}-${new Date().getTime()}`;
    return (React.createElement(FileExportPreview, { format: exportFormat, textDefinition: (_c = exportData.data) !== null && _c !== void 0 ? _c : '', downloadFileName: downloadFileName, onClose: onClose }));
};
export const GrafanaRuleDesignExporter = React.memo(({ onClose, exportValues, uid }) => {
    const [activeTab, setActiveTab] = useState('yaml');
    return (React.createElement(GrafanaExportDrawer, { title: 'Export Group', activeTab: activeTab, onTabChange: setActiveTab, onClose: onClose, formatProviders: Object.values(allGrafanaExportProviders) },
        React.createElement(GrafanaRuleDesignExportPreview, { exportFormat: activeTab, onClose: onClose, exportValues: exportValues, uid: uid })));
});
GrafanaRuleDesignExporter.displayName = 'GrafanaRuleDesignExporter';
//# sourceMappingURL=ModifyExportRuleForm.js.map