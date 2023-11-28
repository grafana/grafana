import { __awaiter, __rest } from "tslib";
import { css } from '@emotion/css';
import { debounce, take, uniqueId } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import { AppEvents } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { AsyncSelect, Button, Field, Input, InputControl, Label, Modal, Text, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { contextSrv } from 'app/core/services/context_srv';
import { createFolder } from 'app/features/manage-dashboards/state/actions';
import { AccessControlAction, useDispatch } from 'app/types';
import { useCombinedRuleNamespaces } from '../../hooks/useCombinedRuleNamespaces';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { fetchRulerRulesAction } from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { MINUTE } from '../../utils/rule-form';
import { isGrafanaRulerRule } from '../../utils/rules';
import { ProvisioningBadge } from '../Provisioning';
import { evaluateEveryValidationOptions } from '../rules/EditRuleGroupModal';
import { containsSlashes, RuleFolderPicker } from './RuleFolderPicker';
import { checkForPathSeparator } from './util';
export const MAX_GROUP_RESULTS = 1000;
export const useFolderGroupOptions = (folderTitle, enableProvisionedGroups) => {
    var _a, _b;
    const dispatch = useDispatch();
    // fetch the ruler rules from the database so we can figure out what other "groups" are already defined
    // for our folders
    useEffect(() => {
        dispatch(fetchRulerRulesAction({ rulesSourceName: GRAFANA_RULES_SOURCE_NAME }));
    }, [dispatch]);
    const rulerRuleRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
    const groupfoldersForGrafana = rulerRuleRequests[GRAFANA_RULES_SOURCE_NAME];
    const grafanaFolders = useCombinedRuleNamespaces(GRAFANA_RULES_SOURCE_NAME);
    const folderGroups = (_b = (_a = grafanaFolders.find((f) => f.name === folderTitle)) === null || _a === void 0 ? void 0 : _a.groups) !== null && _b !== void 0 ? _b : [];
    const groupOptions = folderGroups
        .map((group) => {
        var _a;
        const isProvisioned = isProvisionedGroup(group);
        return {
            label: group.name,
            value: group.name,
            description: (_a = group.interval) !== null && _a !== void 0 ? _a : MINUTE,
            // we include provisioned folders, but disable the option to select them
            isDisabled: !enableProvisionedGroups ? isProvisioned : false,
            isProvisioned: isProvisioned,
        };
    })
        .sort(sortByLabel);
    return { groupOptions, loading: groupfoldersForGrafana === null || groupfoldersForGrafana === void 0 ? void 0 : groupfoldersForGrafana.loading };
};
const isProvisionedGroup = (group) => {
    return group.rules.some((rule) => isGrafanaRulerRule(rule.rulerRule) && Boolean(rule.rulerRule.grafana_alert.provenance) === true);
};
const sortByLabel = (a, b) => {
    var _a, _b;
    return ((_a = a.label) === null || _a === void 0 ? void 0 : _a.localeCompare((_b = b.label) !== null && _b !== void 0 ? _b : '')) || 0;
};
const findGroupMatchingLabel = (group, query) => {
    var _a;
    return (_a = group.label) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(query.toLowerCase());
};
export function FolderAndGroup({ groupfoldersForGrafana, enableProvisionedGroups, }) {
    var _a, _b, _c, _d, _e;
    const { formState: { errors }, watch, setValue, control, } = useFormContext();
    const styles = useStyles2(getStyles);
    const folder = watch('folder');
    const group = watch('group');
    const { groupOptions, loading } = useFolderGroupOptions((_a = folder === null || folder === void 0 ? void 0 : folder.title) !== null && _a !== void 0 ? _a : '', enableProvisionedGroups);
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [isCreatingEvaluationGroup, setIsCreatingEvaluationGroup] = useState(false);
    const onOpenFolderCreationModal = () => setIsCreatingFolder(true);
    const onOpenEvaluationGroupCreationModal = () => setIsCreatingEvaluationGroup(true);
    const handleFolderCreation = (folder) => {
        resetGroup();
        setValue('folder', folder);
        setIsCreatingFolder(false);
    };
    const handleEvalGroupCreation = (groupName, evaluationInterval) => {
        setValue('group', groupName);
        setValue('evaluateEvery', evaluationInterval);
        setIsCreatingEvaluationGroup(false);
    };
    const resetGroup = useCallback(() => {
        setValue('group', '');
    }, [setValue]);
    const getOptions = useCallback((query) => __awaiter(this, void 0, void 0, function* () {
        const results = query ? groupOptions.filter((group) => findGroupMatchingLabel(group, query)) : groupOptions;
        return take(results, MAX_GROUP_RESULTS);
    }), [groupOptions]);
    const debouncedSearch = useMemo(() => {
        return debounce(getOptions, 300, { leading: true });
    }, [getOptions]);
    const defaultGroupValue = group ? { value: group, label: group } : undefined;
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", null,
            React.createElement(Field, { label: React.createElement(Label, { htmlFor: "folder", description: 'Select a folder to store your rule.' }, "Folder"), className: styles.formInput, error: (_b = errors.folder) === null || _b === void 0 ? void 0 : _b.message, invalid: !!((_c = errors.folder) === null || _c === void 0 ? void 0 : _c.message), "data-testid": "folder-picker" },
                React.createElement(Stack, { direction: "row", alignItems: "center" }, (!isCreatingFolder && (React.createElement(React.Fragment, null,
                    React.createElement(InputControl, { render: (_a) => {
                            var _b = _a.field, { ref } = _b, field = __rest(_b, ["ref"]);
                            return (React.createElement("div", { style: { width: 420 } },
                                React.createElement(RuleFolderPicker, Object.assign({ inputId: "folder" }, field, { enableReset: true, onChange: ({ title, uid }) => {
                                        field.onChange({ title, uid });
                                        resetGroup();
                                    } }))));
                        }, name: "folder", rules: {
                            required: { value: true, message: 'Select a folder' },
                            validate: {
                                pathSeparator: (folder) => checkForPathSeparator(folder.title),
                            },
                        } }),
                    React.createElement(Text, { color: "secondary" }, "or"),
                    React.createElement(Button, { onClick: onOpenFolderCreationModal, type: "button", icon: "plus", fill: "outline", variant: "secondary", disabled: !contextSrv.hasPermission(AccessControlAction.FoldersCreate) }, "New folder")))) || React.createElement("div", null, "Creating new folder..."))),
            isCreatingFolder && (React.createElement(FolderCreationModal, { onCreate: handleFolderCreation, onClose: () => setIsCreatingFolder(false) }))),
        React.createElement("div", null,
            React.createElement(Field, { label: "Evaluation group", "data-testid": "group-picker", description: "Rules within the same group are evaluated sequentially over the same time interval.", className: styles.formInput, error: (_d = errors.group) === null || _d === void 0 ? void 0 : _d.message, invalid: !!((_e = errors.group) === null || _e === void 0 ? void 0 : _e.message) },
                React.createElement(Stack, { direction: "row", alignItems: "center" },
                    React.createElement(InputControl, { render: (_a) => {
                            var _b = _a.field, { ref } = _b, field = __rest(_b, ["ref"]), { fieldState } = _a;
                            return (React.createElement("div", { style: { width: 420 } },
                                React.createElement(AsyncSelect, Object.assign({ disabled: !folder || loading, inputId: "group", key: uniqueId() }, field, { onChange: (group) => {
                                        var _a;
                                        field.onChange((_a = group.label) !== null && _a !== void 0 ? _a : '');
                                    }, isLoading: loading, invalid: Boolean(folder) && !group && Boolean(fieldState.error), loadOptions: debouncedSearch, cacheOptions: true, loadingMessage: 'Loading groups...', defaultValue: defaultGroupValue, defaultOptions: groupOptions, getOptionLabel: (option) => (React.createElement("div", null,
                                        React.createElement("span", null, option.label),
                                        option['isProvisioned'] && (React.createElement(React.Fragment, null,
                                            ' ',
                                            React.createElement(ProvisioningBadge, null))))), placeholder: 'Select an evaluation group...' }))));
                        }, name: "group", control: control, rules: {
                            required: { value: true, message: 'Must enter a group name' },
                            validate: {
                                pathSeparator: (group_) => checkForPathSeparator(group_),
                            },
                        } }),
                    React.createElement(Text, { color: "secondary" }, "or"),
                    React.createElement(Button, { onClick: onOpenEvaluationGroupCreationModal, type: "button", icon: "plus", fill: "outline", variant: "secondary", disabled: !folder }, "New evaluation group"))),
            isCreatingEvaluationGroup && (React.createElement(EvaluationGroupCreationModal, { onCreate: handleEvalGroupCreation, onClose: () => setIsCreatingEvaluationGroup(false), groupfoldersForGrafana: groupfoldersForGrafana })))));
}
function FolderCreationModal({ onClose, onCreate, }) {
    const styles = useStyles2(getStyles);
    const [title, setTitle] = useState('');
    const onSubmit = () => __awaiter(this, void 0, void 0, function* () {
        const newFolder = yield createFolder({ title: title });
        if (!newFolder.uid) {
            appEvents.emit(AppEvents.alertError, ['Folder could not be created']);
            return;
        }
        const folder = { title: newFolder.title, uid: newFolder.uid };
        onCreate(folder);
        appEvents.emit(AppEvents.alertSuccess, ['Folder Created', 'OK']);
    });
    const error = containsSlashes(title);
    return (React.createElement(Modal, { className: styles.modal, isOpen: true, title: 'New folder', onDismiss: onClose, onClickBackdrop: onClose },
        React.createElement("div", { className: styles.modalTitle }, "Create a new folder to store your rule"),
        React.createElement("form", { onSubmit: onSubmit },
            React.createElement(Field, { label: React.createElement(Label, { htmlFor: "folder" }, "Folder name"), error: "The folder name can't contain slashes", invalid: error },
                React.createElement(Input, { autoFocus: true, id: "folderName", placeholder: "Enter a name", value: title, onChange: (e) => setTitle(e.currentTarget.value), className: styles.formInput })),
            React.createElement(Modal.ButtonRow, null,
                React.createElement(Button, { variant: "secondary", type: "button", onClick: onClose }, "Cancel"),
                React.createElement(Button, { type: "submit", disabled: !title || error }, "Create")))));
}
function EvaluationGroupCreationModal({ onClose, onCreate, groupfoldersForGrafana, }) {
    var _a, _b, _c, _d, _e;
    const styles = useStyles2(getStyles);
    const onSubmit = () => {
        onCreate(getValues('group'), getValues('evaluateEvery'));
    };
    const { watch } = useFormContext();
    const evaluateEveryId = 'eval-every-input';
    const [groupName, folderName] = watch(['group', 'folder.title']);
    const groupRules = (_c = (groupfoldersForGrafana && ((_b = (_a = groupfoldersForGrafana[folderName]) === null || _a === void 0 ? void 0 : _a.find((g) => g.name === groupName)) === null || _b === void 0 ? void 0 : _b.rules))) !== null && _c !== void 0 ? _c : [];
    const onCancel = () => {
        onClose();
    };
    const formAPI = useForm({
        defaultValues: { group: '', evaluateEvery: '' },
        mode: 'onChange',
        shouldFocusError: true,
    });
    const { register, handleSubmit, formState, getValues } = formAPI;
    return (React.createElement(Modal, { className: styles.modal, isOpen: true, title: 'New evaluation group', onDismiss: onCancel, onClickBackdrop: onCancel },
        React.createElement("div", { className: styles.modalTitle }, "Create a new evaluation group to use for this alert rule."),
        React.createElement(FormProvider, Object.assign({}, formAPI),
            React.createElement("form", { onSubmit: handleSubmit(() => onSubmit()) },
                React.createElement(Field, { label: React.createElement(Label, { htmlFor: 'group' }, "Evaluation group name"), error: (_d = formState.errors.group) === null || _d === void 0 ? void 0 : _d.message, invalid: !!formState.errors.group },
                    React.createElement(Input, Object.assign({ className: styles.formInput, autoFocus: true, id: 'group', placeholder: "Enter a name" }, register('group', { required: { value: true, message: 'Required.' } })))),
                React.createElement(Field, { error: (_e = formState.errors.evaluateEvery) === null || _e === void 0 ? void 0 : _e.message, invalid: !!formState.errors.evaluateEvery, label: React.createElement(Label, { htmlFor: evaluateEveryId, description: "How often is the rule evaluated. Applies to every rule within the group." }, "Evaluation interval") },
                    React.createElement(Input, Object.assign({ className: styles.formInput, id: evaluateEveryId, placeholder: "e.g. 5m" }, register('evaluateEvery', evaluateEveryValidationOptions(groupRules))))),
                React.createElement(Modal.ButtonRow, null,
                    React.createElement(Button, { variant: "secondary", type: "button", onClick: onCancel }, "Cancel"),
                    React.createElement(Button, { type: "submit", disabled: !formState.isValid }, "Create"))))));
}
const getStyles = (theme) => ({
    container: css `
    display: flex;
    flex-direction: column;
    align-items: baseline;
    max-width: ${theme.breakpoints.values.lg}px;
    justify-content: space-between;
  `,
    formInput: css `
    flex-grow: 1;
  `,
    modal: css `
    width: ${theme.breakpoints.values.sm}px;
  `,
    modalTitle: css `
    color: ${theme.colors.text.secondary};
    margin-bottom: ${theme.spacing(2)};
  `,
});
//# sourceMappingURL=FolderAndGroup.js.map