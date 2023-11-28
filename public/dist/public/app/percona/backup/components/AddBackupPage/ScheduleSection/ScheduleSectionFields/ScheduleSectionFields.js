import React from 'react';
import { Field } from 'react-final-form';
import { useStyles2 } from '@grafana/ui';
import { MultiSelectField } from 'app/percona/shared/components/Form/MultiSelectField';
import { SelectField } from 'app/percona/shared/components/Form/SelectFieldCore';
import { validators } from 'app/percona/shared/helpers/validatorsForm';
import { DAY_OPTIONS, HOUR_OPTIONS, MAX_VISIBLE_OPTIONS, MINUTE_OPTIONS, MONTH_OPTIONS, WEEKDAY_OPTIONS, } from '../../AddBackupPage.constants';
import { isCronFieldDisabled, PERIOD_OPTIONS } from '../../AddBackupPage.utils';
import { Messages } from './ScheduleSectionFields.messages';
import { getStyles } from './ScheduleSectionFields.styles';
import { ScheduleSectionFields as ScheduleSectionFieldsEnum, } from './ScheduleSectionFields.types';
export const ScheduleSectionFields = ({ values }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.scheduleSectionWrapper, "data-testid": "shedule-section-fields-wrapper" },
        React.createElement(Field, { name: "period", validate: validators.required }, ({ input }) => (React.createElement("div", { className: styles.firstSelectRow },
            React.createElement(SelectField, Object.assign({}, input, { options: PERIOD_OPTIONS, label: Messages.scheduledTime }))))),
        React.createElement("span", { className: isCronFieldDisabled(values.period.value, ScheduleSectionFieldsEnum.month)
                ? styles.displayNone
                : styles.multiSelectField },
            React.createElement(Field, { name: "month" }, ({ input }) => (React.createElement("div", { className: styles.multiselectRow, "data-testid": "multi-select-field-div-wrapper" },
                React.createElement("span", { className: styles.selectLabel }, Messages.in),
                React.createElement("div", null,
                    React.createElement(MultiSelectField, Object.assign({}, input, { closeMenuOnSelect: false, options: MONTH_OPTIONS, isClearable: true, label: Messages.month, placeholder: Messages.everyMonth, className: styles.selectField, maxVisibleValues: MAX_VISIBLE_OPTIONS, disabled: isCronFieldDisabled(values.period.value, ScheduleSectionFieldsEnum.month) }))))))),
        React.createElement("span", { className: isCronFieldDisabled(values.period.value, ScheduleSectionFieldsEnum.day)
                ? styles.displayNone
                : styles.multiSelectField },
            React.createElement(Field, { name: "day" }, ({ input }) => (React.createElement("div", { className: styles.multiselectRow },
                React.createElement("span", { className: styles.selectLabel }, Messages.on),
                React.createElement("div", null,
                    React.createElement(MultiSelectField, Object.assign({}, input, { closeMenuOnSelect: false, options: DAY_OPTIONS, isClearable: true, label: Messages.day, placeholder: Messages.everyDay, maxVisibleValues: MAX_VISIBLE_OPTIONS, disabled: isCronFieldDisabled(values.period.value, ScheduleSectionFieldsEnum.day), className: styles.selectField }))))))),
        React.createElement("span", { className: isCronFieldDisabled(values.period.value, ScheduleSectionFieldsEnum.weekDay)
                ? styles.displayNone
                : styles.multiSelectField },
            React.createElement(Field, { name: "weekDay" }, ({ input }) => (React.createElement("div", { className: styles.multiselectRow },
                React.createElement("span", { className: styles.selectLabel }, Messages.on),
                React.createElement("div", null,
                    React.createElement(MultiSelectField, Object.assign({}, input, { closeMenuOnSelect: false, options: WEEKDAY_OPTIONS, isClearable: true, label: Messages.weekDay, placeholder: Messages.everyWeekDay, maxVisibleValues: MAX_VISIBLE_OPTIONS, disabled: isCronFieldDisabled(values.period.value, ScheduleSectionFieldsEnum.weekDay), className: styles.selectField }))))))),
        React.createElement("span", { className: isCronFieldDisabled(values.period.value, ScheduleSectionFieldsEnum.startHour)
                ? styles.displayNone
                : styles.multiSelectField },
            React.createElement(Field, { name: "startHour" }, ({ input }) => (React.createElement("div", { className: styles.multiselectRow },
                React.createElement("span", { className: styles.selectLabel }, Messages.at),
                React.createElement("div", null,
                    React.createElement(MultiSelectField, Object.assign({}, input, { closeMenuOnSelect: false, options: HOUR_OPTIONS, isClearable: true, placeholder: Messages.everyHour, label: Messages.hour, maxVisibleValues: MAX_VISIBLE_OPTIONS, disabled: isCronFieldDisabled(values.period.value, ScheduleSectionFieldsEnum.startHour), className: styles.selectField }))))))),
        React.createElement("span", { className: isCronFieldDisabled(values.period.value, ScheduleSectionFieldsEnum.startMinute)
                ? styles.displayNone
                : styles.multiSelectField },
            React.createElement(Field, { name: "startMinute" }, ({ input }) => (React.createElement("div", { className: styles.multiselectRow },
                React.createElement("span", { className: styles.selectLabel }, Messages.at),
                React.createElement("div", null,
                    React.createElement(MultiSelectField, Object.assign({}, input, { closeMenuOnSelect: false, options: MINUTE_OPTIONS, isClearable: true, label: Messages.minute, placeholder: Messages.everyMinute, maxVisibleValues: MAX_VISIBLE_OPTIONS, disabled: isCronFieldDisabled(values.period.value, ScheduleSectionFieldsEnum.startMinute), className: styles.selectField })))))))));
};
//# sourceMappingURL=ScheduleSectionFields.js.map