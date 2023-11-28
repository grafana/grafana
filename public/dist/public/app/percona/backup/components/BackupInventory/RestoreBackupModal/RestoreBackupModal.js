import { cx } from '@emotion/css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Field, withTypes } from 'react-final-form';
import { toUtc } from '@grafana/data';
import { Alert, Button, DateTimePicker, HorizontalGroup, useStyles2 } from '@grafana/ui';
import { BackupMode } from 'app/percona/backup/Backup.types';
import { LoaderButton } from 'app/percona/shared/components/Elements/LoaderButton';
import { Modal } from 'app/percona/shared/components/Elements/Modal';
import { AsyncSelectField } from 'app/percona/shared/components/Form/AsyncSelectField';
import { Label } from 'app/percona/shared/components/Form/Label';
import { RadioButtonGroupField } from 'app/percona/shared/components/Form/RadioButtonGroup';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { Databases, DATABASE_LABELS } from 'app/percona/shared/core';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { BackupErrorSection } from '../../BackupErrorSection/BackupErrorSection';
import { LocationType } from '../../StorageLocations/StorageLocations.types';
import { BackupInventoryService } from '../BackupInventory.service';
import { Messages } from './RestoreBackupModal.messages';
import { RestoreBackupModalService } from './RestoreBackupModal.service';
import { getStyles } from './RestoreBackupModal.styles';
import { ServiceTypeSelect } from './RestoreBackupModal.types';
import { getHoursFromDate, getMinutesFromDate, getSecondsFromDate, isSameDayFromDate, toFormProps, } from './RestoreBackupModal.utils';
const { Form } = withTypes();
const serviceTypeOptions = [
    {
        value: ServiceTypeSelect.SAME,
        label: 'Same service',
    },
    {
        value: ServiceTypeSelect.COMPATIBLE,
        label: 'Compatible services',
    },
];
export const RestoreBackupModal = ({ backup, isVisible, noService = false, restoreErrors = [], onClose, onRestore, location, }) => {
    const styles = useStyles2(getStyles);
    const initialValues = useMemo(() => (backup ? toFormProps(backup) : undefined), [backup]);
    const [selectedTimerange, setSelectedTimerange] = useState();
    const [selectedTimerangeFromDatepicker, setSelectedTimerangeFromDatepicker] = useState();
    const [selectedDay, setSelectedDay] = useState();
    const showTimeRanges = (backup === null || backup === void 0 ? void 0 : backup.mode) === BackupMode.PITR;
    const hideRestoreForm = (backup === null || backup === void 0 ? void 0 : backup.mode) === BackupMode.PITR && (location === null || location === void 0 ? void 0 : location.type) === LocationType.CLIENT;
    const isSameStartDate = useMemo(() => {
        if (selectedDay && selectedTimerange) {
            return isSameDayFromDate(selectedDay, selectedTimerange.startTimestamp);
        }
        return false;
    }, [selectedDay, selectedTimerange]);
    const isSameEndDate = useMemo(() => {
        if (selectedDay && selectedTimerange) {
            return isSameDayFromDate(selectedDay, selectedTimerange.endTimestamp);
        }
        return false;
    }, [selectedDay, selectedTimerange]);
    const hoursFromStartDate = useMemo(() => {
        if (selectedDay && selectedTimerange) {
            return getHoursFromDate(selectedTimerange.startTimestamp);
        }
        return false;
    }, [selectedDay, selectedTimerange]);
    const hoursFromEndDate = useMemo(() => {
        if (selectedDay && selectedTimerange) {
            return getHoursFromDate(selectedTimerange.endTimestamp);
        }
        return false;
    }, [selectedDay, selectedTimerange]);
    const minutesFromStartDate = useMemo(() => {
        if (selectedDay && selectedTimerange) {
            return getMinutesFromDate(selectedTimerange.startTimestamp);
        }
        return false;
    }, [selectedDay, selectedTimerange]);
    const minutesFromEndDate = useMemo(() => {
        if (selectedDay && selectedTimerange) {
            return getMinutesFromDate(selectedTimerange.endTimestamp);
        }
        return false;
    }, [selectedDay, selectedTimerange]);
    const secondsFromStartDate = useMemo(() => {
        if (selectedDay && selectedTimerange) {
            return getSecondsFromDate(selectedTimerange.startTimestamp);
        }
        return false;
    }, [selectedDay, selectedTimerange]);
    const secondsFromEndDate = useMemo(() => {
        if (selectedDay && selectedTimerange) {
            return getSecondsFromDate(selectedTimerange.endTimestamp);
        }
        return false;
    }, [selectedDay, selectedTimerange]);
    const handleSubmit = ({ serviceType, service }) => {
        if (backup) {
            const serviceId = serviceType === ServiceTypeSelect.SAME ? backup.serviceId : service.value;
            if (backup.mode === BackupMode.PITR && selectedTimerangeFromDatepicker) {
                return onRestore(serviceId || '', backup.id, selectedTimerangeFromDatepicker.toISOString());
            }
            else {
                return onRestore(serviceId || '', backup.id);
            }
        }
        return;
    };
    const calculateDisableHours = useCallback(() => {
        const disabledHours = [];
        for (let i = 0; i < 24; i++) {
            if (isSameStartDate) {
                if (i < hoursFromStartDate) {
                    disabledHours.push(i);
                }
            }
            if (isSameEndDate) {
                if (i > hoursFromEndDate) {
                    disabledHours.push(i);
                }
            }
        }
        return disabledHours;
    }, [hoursFromEndDate, hoursFromStartDate, isSameEndDate, isSameStartDate]);
    const calculateDisableMinutes = useCallback((hour) => {
        const disabledMinutes = [];
        for (let i = 0; i < 60; i++) {
            if (isSameStartDate && hour === hoursFromStartDate) {
                if (i < minutesFromStartDate) {
                    disabledMinutes.push(i);
                }
            }
            if (isSameEndDate && hour === hoursFromEndDate) {
                if (i > minutesFromEndDate) {
                    disabledMinutes.push(i);
                }
            }
        }
        return disabledMinutes;
    }, [hoursFromEndDate, hoursFromStartDate, isSameEndDate, isSameStartDate, minutesFromEndDate, minutesFromStartDate]);
    const calculateDisableSeconds = useCallback((hour, minute) => {
        const disabledSeconds = [];
        for (let i = 0; i < 60; i++) {
            if (isSameStartDate && hour === hoursFromStartDate && minute === minutesFromStartDate) {
                if (i < secondsFromStartDate) {
                    disabledSeconds.push(i);
                }
            }
            if (isSameEndDate && hour === hoursFromEndDate && minute === minutesFromEndDate) {
                if (i > secondsFromEndDate) {
                    disabledSeconds.push(i);
                }
            }
        }
        return disabledSeconds;
    }, [
        hoursFromEndDate,
        hoursFromStartDate,
        isSameEndDate,
        isSameStartDate,
        minutesFromEndDate,
        minutesFromStartDate,
        secondsFromEndDate,
        secondsFromStartDate,
    ]);
    useEffect(() => {
        if (selectedTimerange && selectedDay) {
            const { startTimestamp, endTimestamp } = selectedTimerange;
            if (isSameStartDate) {
                setSelectedTimerangeFromDatepicker(toUtc(startTimestamp));
            }
            if (isSameEndDate) {
                setSelectedTimerangeFromDatepicker(toUtc(endTimestamp));
            }
        }
    }, [isSameEndDate, isSameStartDate, selectedDay, selectedTimerange]);
    useEffect(() => {
        if (selectedTimerange) {
            const { endTimestamp } = selectedTimerange;
            setSelectedDay(new Date(endTimestamp));
            setSelectedTimerangeFromDatepicker(toUtc(endTimestamp));
        }
    }, [selectedTimerange]);
    return (React.createElement("span", { className: cx(styles.modalContainer, { rangeSelected: !!selectedTimerange }) },
        React.createElement(Modal, { isVisible: isVisible, title: Messages.title, onClose: onClose }, hideRestoreForm ? (React.createElement(React.Fragment, null,
            React.createElement(Alert, { title: "", severity: "info" }, Messages.localRestoreDisabled),
            React.createElement(HorizontalGroup, { justify: "center", spacing: "md" },
                React.createElement(Button, { onClick: onClose }, Messages.close)))) : (React.createElement(Form, { initialValues: initialValues, onSubmit: handleSubmit, render: ({ handleSubmit, valid, submitting, values }) => (React.createElement("form", { onSubmit: handleSubmit },
                React.createElement("div", { className: styles.modalWrapper },
                    showTimeRanges && (React.createElement(React.Fragment, null,
                        React.createElement(Field, { name: "timerange", validate: validators.required }, ({ input }) => (React.createElement("div", null,
                            React.createElement(AsyncSelectField, Object.assign({ className: styles.timeRangeSelect, label: Messages.timeRange, loadOptions: () => BackupInventoryService.listPitrTimeranges(backup.id) }, input, { defaultOptions: true, "data-testid": "time-range-select-input", onChange: (e) => {
                                    setSelectedTimerange(e.value);
                                    input.onChange(e);
                                } }))))))),
                    selectedTimerange && (React.createElement("div", null,
                        React.createElement(Label, { label: "Timestamp" }),
                        React.createElement(DateTimePicker, { date: selectedTimerangeFromDatepicker, onChange: setSelectedTimerangeFromDatepicker, calendarProps: {
                                minDate: new Date(selectedTimerange.startTimestamp),
                                maxDate: new Date(selectedTimerange.endTimestamp),
                                onClickDay: setSelectedDay,
                            }, timepickerProps: {
                                disabledHours: calculateDisableHours,
                                disabledMinutes: calculateDisableMinutes,
                                disabledSeconds: calculateDisableSeconds,
                                hideDisabledOptions: true,
                            }, inputWrapperClassName: styles.inputWrapper, growInlineField: true, shrinkInlineField: true }))),
                    showTimeRanges && !selectedTimerange && React.createElement("div", null),
                    React.createElement(RadioButtonGroupField, { className: styles.radioGroup, options: serviceTypeOptions, name: "serviceType", label: Messages.serviceSelection, fullWidth: true, disabled: values.vendor !== DATABASE_LABELS[Databases.mysql] &&
                            values.vendor !== DATABASE_LABELS[Databases.mongodb] }),
                    React.createElement(TextInputField, { disabled: true, name: "vendor", label: Messages.vendor }),
                    React.createElement(Field, { name: "service", validate: validators.required }, ({ input }) => (React.createElement("div", null,
                        React.createElement(AsyncSelectField, Object.assign({ label: Messages.serviceName, disabled: values.serviceType === ServiceTypeSelect.SAME, loadOptions: () => RestoreBackupModalService.loadLocationOptions(backup.id), defaultOptions: true }, input, { "data-testid": "service-select-input" }))))),
                    React.createElement(TextInputField, { disabled: true, name: "dataModel", label: Messages.dataModel })),
                React.createElement(Alert, { title: "", severity: "warning" }, Messages.scheduledWarning),
                !!restoreErrors.length && React.createElement(BackupErrorSection, { backupErrors: restoreErrors }),
                React.createElement(HorizontalGroup, { justify: "center", spacing: "md" },
                    React.createElement(LoaderButton, { "data-testid": "restore-button", size: "md", variant: "primary", disabled: !valid || (values.serviceType === ServiceTypeSelect.SAME && noService), loading: submitting, type: "submit" }, Messages.restore),
                    React.createElement(Button, { "data-testid": "restore-cancel-button", variant: "secondary", onClick: onClose }, Messages.close)),
                React.createElement("div", { className: styles.errorLine, "data-testid": "backup-modal-error" }, values.serviceType === ServiceTypeSelect.SAME && noService && Messages.noService))) })))));
};
//# sourceMappingURL=RestoreBackupModal.js.map