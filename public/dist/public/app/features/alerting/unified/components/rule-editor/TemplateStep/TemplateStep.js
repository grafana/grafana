import { __awaiter, __rest } from "tslib";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { Stack } from '@grafana/experimental';
import { Field, Icon, Input, InputControl, Label, Select, Tooltip, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { TemplateParamType, } from 'app/percona/integrated-alerting/components/AlertRuleTemplate/AlertRuleTemplate.types';
import { fetchTemplatesAction } from 'app/percona/shared/core/reducers';
import { getTemplates } from 'app/percona/shared/core/selectors';
import { AccessControlAction, useDispatch, useSelector } from 'app/types';
import { fetchExternalAlertmanagersConfigAction } from '../../../state/actions';
import { initialAsyncRequestState } from '../../../utils/redux';
import { durationValidationPattern, parseDurationToMilliseconds } from '../../../utils/time';
import { RuleEditorSection } from '../RuleEditorSection';
import { RuleFolderPicker } from '../RuleFolderPicker';
import { checkForPathSeparator } from '../util';
import { AdvancedRuleSection } from './AdvancedRuleSection/AdvancedRuleSection';
import TemplateFiltersField from './TemplateFiltersField';
import { SEVERITY_OPTIONS } from './TemplateStep.constants';
import { Messages } from './TemplateStep.messages';
import { getStyles } from './TemplateStep.styles';
import { formatTemplateOptions } from './TemplateStep.utils';
const useRuleFolderFilter = (existingRuleForm) => {
    const isSearchHitAvailable = useCallback((hit) => {
        // @PERCONA_TODO
        // const rbacDisabledFallback = contextSrv.hasEditPermissionInFolders;
        const canCreateRuleInFolder = contextSrv.hasPermissionInMetadata(AccessControlAction.AlertingRuleCreate, hit);
        const canUpdateInCurrentFolder = existingRuleForm &&
            // hit.folderId === existingRuleForm.id &&
            contextSrv.hasPermissionInMetadata(AccessControlAction.AlertingRuleUpdate, hit);
        return canCreateRuleInFolder || canUpdateInCurrentFolder;
    }, [existingRuleForm]);
    return useCallback((folderHits) => folderHits.filter(isSearchHitAvailable), [isSearchHitAvailable]);
};
export const TemplateStep = () => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    const { register, setValue, getValues, formState: { errors }, } = useFormContext();
    const dispatch = useDispatch();
    const templates = useRef([]);
    const styles = useStyles2(getStyles);
    const [currentTemplate, setCurrentTemplate] = useState();
    const [queryParams] = useQueryParams();
    const folderFilter = useRuleFolderFilter(null);
    /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */
    const selectedTemplate = queryParams['template'] || null;
    const { result: templatesResult, loading: templatesLoading } = useSelector(getTemplates) || initialAsyncRequestState;
    const templateOptions = formatTemplateOptions((templatesResult === null || templatesResult === void 0 ? void 0 : templatesResult.templates) || []);
    templates.current = (templatesResult === null || templatesResult === void 0 ? void 0 : templatesResult.templates) || [];
    const setRuleNameAfterTemplate = useCallback((template) => {
        const value = getValues('ruleName');
        const valueExists = templates.current.find((opt) => value === `${opt.name} Alerting Rule`);
        if (valueExists || !value) {
            setValue('ruleName', `${template === null || template === void 0 ? void 0 : template.name} Alerting Rule`);
        }
    }, [getValues, setValue]);
    const handleTemplateChange = useCallback((selectedTemplate, onChange) => {
        var _a;
        const newTemplate = templates.current.find((template) => template.name === (selectedTemplate === null || selectedTemplate === void 0 ? void 0 : selectedTemplate.name));
        const severityStr = newTemplate === null || newTemplate === void 0 ? void 0 : newTemplate.severity;
        const newSeverity = SEVERITY_OPTIONS.find((severity) => severity.value === severityStr);
        setCurrentTemplate(newTemplate);
        if (newSeverity && newSeverity.value) {
            // @ts-ignore
            setValue('severity', newSeverity.value);
        }
        setValue('duration', (newTemplate === null || newTemplate === void 0 ? void 0 : newTemplate.for) || '1m');
        setRuleNameAfterTemplate(newTemplate);
        if (newTemplate) {
            (_a = newTemplate.params) === null || _a === void 0 ? void 0 : _a.forEach(({ type, float, name }) => {
                // TODO add missing types when supported
                if (type === TemplateParamType.FLOAT && (float === null || float === void 0 ? void 0 : float.default) !== undefined) {
                    // @ts-ignore
                    setValue(name, float.default);
                }
            });
        }
        if (!!onChange) {
            onChange(selectedTemplate);
        }
    }, [setRuleNameAfterTemplate, setValue]);
    useEffect(() => {
        const getData = () => __awaiter(void 0, void 0, void 0, function* () {
            // @PERCONA_TODO check if it's fetching the correct one
            dispatch(fetchExternalAlertmanagersConfigAction());
            // dispatch(fetchExternalAlertmanagersConfigAction('grafana'));
            const { templates } = yield dispatch(fetchTemplatesAction()).unwrap();
            if (selectedTemplate) {
                const matchingTemplate = templates.find((template) => template.name === selectedTemplate);
                if (matchingTemplate) {
                    setValue('template', matchingTemplate);
                    setRuleNameAfterTemplate(matchingTemplate);
                    handleTemplateChange(matchingTemplate);
                }
            }
        });
        getData();
    }, [dispatch, handleTemplateChange, selectedTemplate, setRuleNameAfterTemplate, setValue]);
    return (React.createElement(RuleEditorSection, { stepNo: 2, title: "Template details" },
        React.createElement(Field, { label: Messages.templateField, description: Messages.tooltips.template, error: (_a = errors.template) === null || _a === void 0 ? void 0 : _a.message, invalid: !!((_b = errors.template) === null || _b === void 0 ? void 0 : _b.message) },
            React.createElement(Controller, { name: "template", rules: { required: { value: true, message: Messages.errors.template } }, render: ({ field: { value, onChange } }) => (React.createElement(Select, { id: "template", isLoading: templatesLoading, disabled: templatesLoading, placeholder: templatesLoading ? Messages.loadingTemplates : undefined, value: templateOptions === null || templateOptions === void 0 ? void 0 : templateOptions.find((opt) => { var _a; return ((_a = opt.value) === null || _a === void 0 ? void 0 : _a.name) === (value === null || value === void 0 ? void 0 : value.name); }), onChange: (selectedTemplate) => handleTemplateChange(selectedTemplate.value, onChange), options: templateOptions, "data-testid": "template-select-input" })) })),
        React.createElement(Field, { label: Messages.nameField, description: Messages.tooltips.name, error: (_c = errors.name) === null || _c === void 0 ? void 0 : _c.message, invalid: !!((_d = errors.name) === null || _d === void 0 ? void 0 : _d.message) },
            React.createElement(Input, Object.assign({ id: "ruleName" }, register('ruleName', { required: { value: true, message: Messages.errors.name } })))), (_e = currentTemplate === null || currentTemplate === void 0 ? void 0 : currentTemplate.params) === null || _e === void 0 ? void 0 :
        _e.map(({ float, type, name, summary, unit }) => {
            var _a, _b;
            return type === TemplateParamType.FLOAT && (React.createElement(Field, { key: name, label: `${name[0].toUpperCase()}${name.slice(1)}`, description: Messages.getFloatDescription(summary, unit, float), 
                // @ts-ignore
                error: (_a = errors[name]) === null || _a === void 0 ? void 0 : _a.message, 
                // @ts-ignore
                invalid: !!((_b = errors[name]) === null || _b === void 0 ? void 0 : _b.message) },
                React.createElement(Input, Object.assign({ type: "number" }, register(name, {
                    required: { value: true, message: Messages.errors.floatParamRequired(name) },
                    min: (float === null || float === void 0 ? void 0 : float.hasMin)
                        ? { value: float.min || 0, message: Messages.errors.floatParamMin(float.min || 0) }
                        : undefined,
                    max: (float === null || float === void 0 ? void 0 : float.hasMax)
                        ? { value: float.max || 0, message: Messages.errors.floatParamMax(float.max || 0) }
                        : undefined,
                }), { name: name, defaultValue: `${float === null || float === void 0 ? void 0 : float.default}` }))));
        }),
        React.createElement(Field, { label: Messages.durationField, description: Messages.tooltips.duration, error: (_f = errors.duration) === null || _f === void 0 ? void 0 : _f.message, invalid: !!((_g = errors.duration) === null || _g === void 0 ? void 0 : _g.message) },
            React.createElement(Input, Object.assign({ id: "duration" }, register('duration', {
                required: { value: true, message: Messages.errors.durationRequired },
                pattern: durationValidationPattern,
                validate: (value) => {
                    const millisFor = parseDurationToMilliseconds(value);
                    // 0 is a special value meaning for equals evaluation interval
                    if (millisFor === 0) {
                        return true;
                    }
                    return millisFor > 0 ? true : Messages.errors.durationMin;
                },
            })))),
        React.createElement(Field, { label: Messages.severityField, description: Messages.tooltips.severity, error: (_h = errors.severity) === null || _h === void 0 ? void 0 : _h.message, invalid: !!((_j = errors.severity) === null || _j === void 0 ? void 0 : _j.message) },
            React.createElement(Controller, { name: "severity", rules: { required: { value: true, message: Messages.errors.severity } }, render: ({ field: { onChange, value } }) => (React.createElement(Select, { value: value, onChange: (v) => onChange(v.value), id: "severity", options: SEVERITY_OPTIONS, "data-testid": "severity-select-input" })) })),
        React.createElement("div", { className: styles.folderAndGroupSelect },
            React.createElement(Field, { label: React.createElement(Label, { htmlFor: "folder", description: 'Select a folder to store your rule.' },
                    React.createElement(Stack, { gap: 0.5 },
                        "Folder",
                        React.createElement(Tooltip, { placement: "top", content: React.createElement("div", null, "Each folder has unique folder permission. When you store multiple rules in a folder, the folder access permissions get assigned to the rules.") },
                            React.createElement(Icon, { name: "info-circle", size: "xs" })))), className: styles.folderAndGroupInput, error: (_k = errors.folder) === null || _k === void 0 ? void 0 : _k.message, invalid: !!((_l = errors.folder) === null || _l === void 0 ? void 0 : _l.message), "data-testid": "folder-picker" },
                React.createElement(InputControl, { render: (_a) => {
                        var _b = _a.field, { ref } = _b, field = __rest(_b, ["ref"]);
                        return (React.createElement(RuleFolderPicker, Object.assign({ inputId: "folder" }, field, { enableCreateNew: contextSrv.hasPermission(AccessControlAction.FoldersCreate), enableReset: true, filter: folderFilter })));
                    }, name: "folder", rules: {
                        required: { value: true, message: 'Please select a folder' },
                        validate: {
                            pathSeparator: (folder) => checkForPathSeparator(folder.title),
                        },
                    } })),
            React.createElement(Field, { label: "Group", "data-testid": "group-picker", description: "Rules within the same group are evaluated after the same time interval.", className: styles.folderAndGroupInput, error: (_m = errors.group) === null || _m === void 0 ? void 0 : _m.message, invalid: !!((_o = errors.group) === null || _o === void 0 ? void 0 : _o.message) },
                React.createElement(Input, Object.assign({ id: "group" }, register('group', {
                    required: { value: true, message: 'Must enter a group name' },
                }))))),
        React.createElement(TemplateFiltersField, null),
        currentTemplate && (React.createElement(AdvancedRuleSection, { expression: currentTemplate.expr, summary: (_p = currentTemplate.annotations) === null || _p === void 0 ? void 0 : _p.summary }))));
};
//# sourceMappingURL=TemplateStep.js.map