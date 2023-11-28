import { __awaiter } from "tslib";
/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { cx } from '@emotion/css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Field, withTypes } from 'react-final-form';
import { AppEvents } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { CollapsableSection, CustomScrollbar, LinkButton, PageToolbar, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { LoaderButton } from 'app/percona/shared/components/Elements/LoaderButton';
import { Overlay } from 'app/percona/shared/components/Elements/Overlay';
import { AsyncSelectField } from 'app/percona/shared/components/Form/AsyncSelectField';
import { RadioButtonGroupField } from 'app/percona/shared/components/Form/RadioButtonGroup';
import { SelectField } from 'app/percona/shared/components/Form/SelectField';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { TextareaInputField } from 'app/percona/shared/components/Form/TextareaInput';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { Databases, DATABASE_LABELS } from 'app/percona/shared/core';
import { fetchStorageLocations } from 'app/percona/shared/core/reducers/backups/backupLocations';
import { getBackupLocations } from 'app/percona/shared/core/selectors';
import { apiErrorParser, isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';
import { PageSwitcherCard } from '../../../shared/components/Elements/PageSwitcherCard/PageSwitcherCard';
import { BACKUP_INVENTORY_URL, BACKUP_SCHEDULED_URL } from '../../Backup.constants';
import { Messages as MessagesBackup } from '../../Backup.messages';
import { BackupService } from '../../Backup.service';
import { BackupMode, BackupType, DataModel } from '../../Backup.types';
import { BackupErrorSection } from '../BackupErrorSection/BackupErrorSection';
import { BACKUP_CANCEL_TOKEN, LIST_ARTIFACTS_CANCEL_TOKEN } from '../BackupInventory/BackupInventory.constants';
import { BackupInventoryService } from '../BackupInventory/BackupInventory.service';
import { LIST_SCHEDULED_BACKUPS_CANCEL_TOKEN } from '../ScheduledBackups/ScheduledBackups.constants';
import { ScheduledBackupsService } from '../ScheduledBackups/ScheduledBackups.service';
import { LocationType } from '../StorageLocations/StorageLocations.types';
import { DATA_MODEL_OPTIONS, MAX_BACKUP_NAME, SCHEDULED_TYPE } from './AddBackupPage.constants';
import { Messages } from './AddBackupPage.messages';
import { AddBackupPageService } from './AddBackupPage.service';
import { getStyles } from './AddBackupPage.styles';
import { getBackupModeOptions, getDataModelFromVendor, getLabelForStorageOption, isDataModelDisabled, toFormBackup, } from './AddBackupPage.utils';
import { RetryModeSelector } from './RetryModeSelector';
import { ScheduleSection } from './ScheduleSection/ScheduleSection';
const AddBackupPage = ({ match }) => {
    const [queryParams, setQueryParams] = useQueryParams();
    const scheduleMode = queryParams['scheduled'] || match.params.type === SCHEDULED_TYPE;
    const [backup, setBackup] = useState(null);
    const [pending, setPending] = useState(false);
    const [advancedSectionOpen, setAdvancedSectionOpen] = useState(false);
    const styles = useStyles2(getStyles);
    const dispatch = useAppDispatch();
    const [modalTitle, setModalTitle] = useState(Messages.getModalTitle(scheduleMode, !!backup));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const initialValues = useMemo(() => toFormBackup(backup, scheduleMode), [backup]);
    const { result: locations = [], loading: locationsLoading } = useSelector(getBackupLocations);
    const { Form } = withTypes();
    const locationsOptions = locations.map(({ locationID, name, type }) => ({
        label: name,
        value: locationID,
        type,
        description: getLabelForStorageOption(type),
    }));
    const editing = !!backup;
    const [backupErrors, setBackupErrors] = useState([]);
    const [generateToken] = useCancelToken();
    const getBackupData = useCallback(() => __awaiter(void 0, void 0, void 0, function* () {
        setPending(true);
        try {
            let backups;
            let backup = null;
            if (scheduleMode) {
                backups = yield ScheduledBackupsService.list(generateToken(LIST_SCHEDULED_BACKUPS_CANCEL_TOKEN));
            }
            else {
                backups = yield BackupInventoryService.list(generateToken(LIST_ARTIFACTS_CANCEL_TOKEN));
            }
            for (const value of backups) {
                if (value.id === `/${match.params.type}/${match.params.id}`) {
                    backup = value;
                    break;
                }
            }
            setBackup(backup !== null && backup !== void 0 ? backup : null);
        }
        catch (e) {
            if (isApiCancelError(e)) {
                return;
            }
            logger.error(e);
        }
        setPending(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);
    const handleBackup = (values) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield BackupService.backup(values, generateToken(BACKUP_CANCEL_TOKEN));
            if (scheduleMode) {
                appEvents.emit(AppEvents.alertSuccess, [
                    values.id
                        ? MessagesBackup.scheduledBackups.getEditSuccess(values.backupName)
                        : MessagesBackup.scheduledBackups.addSuccess,
                ]);
                setBackupErrors([]);
                locationService.push(BACKUP_SCHEDULED_URL);
            }
            else {
                appEvents.emit(AppEvents.alertSuccess, [MessagesBackup.backupInventory.addSuccess]);
                setBackupErrors([]);
                locationService.push(BACKUP_INVENTORY_URL);
            }
        }
        catch (e) {
            if (isApiCancelError(e)) {
                return;
            }
            setBackupErrors(apiErrorParser(e));
            logger.error(e);
        }
    });
    const handleSubmit = (values) => {
        handleBackup(Object.assign(Object.assign({}, values), { retention: parseInt(`${values.retention}`, 10), retryTimes: parseInt(`${values.retryTimes}`, 10) }));
    };
    useEffect(() => setModalTitle(Messages.getModalTitle(scheduleMode, editing)), [editing, scheduleMode]);
    useEffect(() => {
        getBackupData();
        dispatch(fetchStorageLocations());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const onDemandClick = useCallback(() => {
        setQueryParams({ scheduled: null });
        setModalTitle(Messages.getModalTitle(false, editing));
    }, [editing, setQueryParams]);
    const onScheduledClick = useCallback(() => {
        setQueryParams({ scheduled: true });
        setModalTitle(Messages.getModalTitle(true, editing));
    }, [editing, setQueryParams]);
    const onToggle = useCallback((open) => setAdvancedSectionOpen(open), []);
    const pageSwitcherValues = useMemo(() => [
        {
            id: 1,
            name: 'type',
            selected: !scheduleMode,
            value: BackupType.DEMAND,
            onClick: onDemandClick,
            label: Messages.onDemand,
            description: Messages.backupDescription,
        },
        {
            id: 2,
            name: 'type',
            selected: scheduleMode,
            value: BackupType.SCHEDULED,
            onClick: onScheduledClick,
            label: Messages.schedule,
            description: Messages.scheduleBackupDescription,
        },
    ], [onDemandClick, onScheduledClick, scheduleMode]);
    return (React.createElement(Overlay, { isPending: pending },
        React.createElement(Form, { initialValues: initialValues, onSubmit: handleSubmit, mutators: {
                changeVendor: ([vendor], state, tools) => {
                    tools.changeValue(state, 'vendor', () => vendor);
                    tools.changeValue(state, 'dataModel', () => getDataModelFromVendor(vendor));
                    //TODO remove this when we support incremental backups for MySQL
                    if (vendor === Databases.mysql) {
                        tools.changeValue(state, 'mode', () => BackupMode.SNAPSHOT);
                    }
                },
                changeDataModel: ([labels], state, tools) => {
                    if (labels === null || labels === void 0 ? void 0 : labels.length) {
                        const label = labels[0].textContent;
                        if (label === BackupMode.PITR) {
                            tools.changeValue(state, 'dataModel', () => DataModel.LOGICAL);
                        }
                    }
                },
                changeFolder: ([cluster], state, tools) => {
                    if (!cluster) {
                        setAdvancedSectionOpen(true);
                    }
                    tools.changeValue(state, 'folder', () => cluster);
                },
            }, render: ({ handleSubmit, valid, pristine, submitting, values, form }) => {
                var _a;
                return (React.createElement("form", { onSubmit: handleSubmit, className: styles.form },
                    React.createElement(PageToolbar, { title: modalTitle, pageIcon: "history" },
                        React.createElement(LinkButton, { href: scheduleMode ? BACKUP_SCHEDULED_URL : BACKUP_INVENTORY_URL, "data-testid": "cancel-button", variant: "secondary", fill: "outline" }, Messages.cancelAction),
                        React.createElement(LoaderButton, { "data-testid": "backup-add-button", size: "md", type: "submit", variant: "primary", disabled: !valid ||
                                pristine ||
                                (values.vendor === Databases.mysql && ((_a = values.location) === null || _a === void 0 ? void 0 : _a.type) === LocationType.CLIENT), loading: submitting }, Messages.getSubmitButtonText(values.type === BackupType.SCHEDULED, editing))),
                    React.createElement("div", { className: styles.contentOuter },
                        React.createElement(CustomScrollbar, { hideHorizontalTrack: true },
                            React.createElement("div", { className: styles.contentInner },
                                React.createElement("div", { className: styles.pageWrapper },
                                    !editing && React.createElement(PageSwitcherCard, { values: pageSwitcherValues }),
                                    React.createElement("h4", { className: styles.headingStyle }, Messages.backupInfo),
                                    React.createElement("div", { className: styles.formContainer },
                                        React.createElement("span", { className: styles.wideField },
                                            React.createElement(TextInputField, { name: "backupName", label: Messages.backupName, validators: [validators.required, validators.maxLength(MAX_BACKUP_NAME)] })),
                                        React.createElement("span", { className: styles.SelectFieldWrap },
                                            React.createElement(Field, { name: "service", validate: validators.required }, ({ input }) => (React.createElement(AsyncSelectField, Object.assign({ label: Messages.serviceName, disabled: editing, loadOptions: AddBackupPageService.loadServiceOptions, cacheOptions: true, defaultOptions: true }, input, { onChange: (service) => {
                                                    input.onChange(service);
                                                    form.mutators.changeVendor(service.value.vendor);
                                                    form.mutators.changeFolder(service.value.cluster);
                                                }, className: styles.selectField, "data-testid": "service-select-input" }))))),
                                        React.createElement("span", { className: styles.radioButtonField },
                                            React.createElement(RadioButtonGroupField, { disabled: isDataModelDisabled(values), options: DATA_MODEL_OPTIONS, name: "dataModel", label: Messages.dataModel, fullWidth: true })),
                                        React.createElement("span", { className: styles.wideField },
                                            React.createElement(TextInputField, { name: "vendor", label: Messages.vendor, disabled: true, format: (vendor) => DATABASE_LABELS[vendor] || '' })),
                                        React.createElement("span", { className: cx(styles.wideField, styles.SelectFieldWrap) },
                                            React.createElement(Field, { name: "location", validate: validators.required }, ({ input }) => (React.createElement("div", null,
                                                React.createElement(SelectField, Object.assign({ label: Messages.location, isSearchable: false, disabled: editing, options: locationsOptions, isLoading: locationsLoading }, input, { className: styles.selectField, "data-testid": "location-select-input" })))))),
                                        scheduleMode && (React.createElement("span", { className: styles.descriptionField },
                                            React.createElement(TextareaInputField, { fieldClassName: styles.textAreaField, name: "description", label: Messages.description }))),
                                        values.type === BackupType.SCHEDULED && (React.createElement("span", { className: cx(styles.radioButtonField, styles.backupTypeField) },
                                            React.createElement(RadioButtonGroupField, { options: getBackupModeOptions(values.vendor), name: "mode", 
                                                //TODO remove this when we support incremental backups for MySQL
                                                disabled: editing || values.vendor === Databases.mysql, label: Messages.type, fullWidth: true, inputProps: {
                                                    onInput: (e) => form.mutators.changeDataModel(e.target.labels),
                                                } })))),
                                    React.createElement("div", { className: styles.advanceSection },
                                        values.type === BackupType.SCHEDULED && React.createElement(ScheduleSection, { values: values }),
                                        React.createElement("div", { className: styles.collapsableSection },
                                            React.createElement(CollapsableSection, { label: Messages.advanceSettings, isOpen: advancedSectionOpen, onToggle: onToggle, controlled: true, buttonDataTestId: "add-backup-advanced-settings" },
                                                React.createElement(RetryModeSelector, { retryMode: values.retryMode }),
                                                React.createElement(TextInputField, { fieldClassName: styles.textAreaField, name: "folder", label: Messages.folder, disabled: editing, tooltipText: Messages.folderTooltip, tooltipLink: Messages.folderTooltipLink(values.vendor, values.mode) })),
                                            !!backupErrors.length && React.createElement(BackupErrorSection, { backupErrors: backupErrors })))))))));
            } })));
};
export default AddBackupPage;
//# sourceMappingURL=AddBackupPage.js.map