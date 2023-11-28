import { css } from '@emotion/css';
import moment from 'moment/moment';
import React, { useState } from 'react';
import { getTimeZoneInfo } from '@grafana/data';
import { Button, Field, FieldSet, HorizontalGroup, Select, TimeZonePicker, useStyles2 } from '@grafana/ui';
import { TimeZoneOffset } from '@grafana/ui/src/components/DateTimePickers/TimeZonePicker/TimeZoneOffset';
import { TimeZoneTitle } from '@grafana/ui/src/components/DateTimePickers/TimeZonePicker/TimeZoneTitle';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { TimePickerInput } from './TimePickerInput';
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((v, idx) => {
    return {
        label: v,
        value: idx + 1,
    };
});
export const TimeRegionEditor = ({ value, onChange }) => {
    var _a, _b, _c, _d;
    const styles = useStyles2(getStyles);
    const timestamp = Date.now();
    const timezoneInfo = getTimeZoneInfo((_a = value.timezone) !== null && _a !== void 0 ? _a : 'utc', timestamp);
    const isDashboardTimezone = ((_b = getDashboardSrv().getCurrent()) === null || _b === void 0 ? void 0 : _b.getTimezone()) === value.timezone;
    const [isEditing, setEditing] = useState(false);
    const onToggleChangeTimezone = () => {
        setEditing(!isEditing);
    };
    const getTime = (time) => {
        if (!time) {
            return undefined;
        }
        const date = moment();
        if (time) {
            const match = time.split(':');
            date.set('hour', parseInt(match[0], 10));
            date.set('minute', parseInt(match[1], 10));
        }
        return date;
    };
    const getToPlaceholder = () => {
        let placeholder = 'Everyday';
        if (value.fromDayOfWeek && !value.toDayOfWeek) {
            placeholder = days[value.fromDayOfWeek - 1].label;
        }
        return placeholder;
    };
    const renderTimezonePicker = () => {
        const timezone = (React.createElement(React.Fragment, null,
            React.createElement(TimeZoneTitle, { title: timezoneInfo === null || timezoneInfo === void 0 ? void 0 : timezoneInfo.name }),
            React.createElement(TimeZoneOffset, { timeZone: value.timezone, timestamp: timestamp })));
        if (isDashboardTimezone) {
            return React.createElement(React.Fragment, null,
                "Dashboard timezone (",
                timezone,
                ")");
        }
        return timezone;
    };
    const onTimeChange = (v, field) => {
        const time = v ? v.format('HH:mm') : undefined;
        if (field === 'from') {
            onChange(Object.assign(Object.assign({}, value), { from: time }));
        }
        else {
            onChange(Object.assign(Object.assign({}, value), { to: time }));
        }
    };
    const onTimezoneChange = (v) => {
        onChange(Object.assign(Object.assign({}, value), { timezone: v }));
    };
    const onFromDayOfWeekChange = (v) => {
        const fromDayOfWeek = v ? v.value : undefined;
        const toDayOfWeek = v ? value.toDayOfWeek : undefined; // clear if everyday
        onChange(Object.assign(Object.assign({}, value), { fromDayOfWeek, toDayOfWeek }));
    };
    const onToDayOfWeekChange = (v) => {
        onChange(Object.assign(Object.assign({}, value), { toDayOfWeek: v ? v.value : undefined }));
    };
    const renderTimezone = () => {
        if (isEditing) {
            return (React.createElement(TimeZonePicker, { value: value.timezone, includeInternal: true, onChange: (v) => onTimezoneChange(v), onBlur: () => setEditing(false), openMenuOnFocus: false, width: 100, autoFocus: true }));
        }
        return (React.createElement("div", { className: styles.timezoneContainer },
            React.createElement("div", { className: styles.timezone }, renderTimezonePicker()),
            React.createElement(Button, { variant: "secondary", onClick: onToggleChangeTimezone, size: "sm" }, "Change timezone")));
    };
    return (React.createElement(FieldSet, { className: styles.wrapper },
        React.createElement(Field, { label: "From" },
            React.createElement(HorizontalGroup, { spacing: "xs" },
                React.createElement(Select, { options: days, isClearable: true, placeholder: "Everyday", value: (_c = value.fromDayOfWeek) !== null && _c !== void 0 ? _c : null, onChange: (v) => onFromDayOfWeekChange(v), width: 20 }),
                React.createElement(TimePickerInput, { value: getTime(value.from), onChange: (v) => onTimeChange(v, 'from'), allowEmpty: true, placeholder: "HH:mm", width: 100 }))),
        React.createElement(Field, { label: "To" },
            React.createElement(HorizontalGroup, { spacing: "xs" },
                (value.fromDayOfWeek || value.toDayOfWeek) && (React.createElement(Select, { options: days, isClearable: true, placeholder: getToPlaceholder(), value: (_d = value.toDayOfWeek) !== null && _d !== void 0 ? _d : null, onChange: (v) => onToDayOfWeekChange(v), width: 20 })),
                React.createElement(TimePickerInput, { value: getTime(value.to), onChange: (v) => onTimeChange(v, 'to'), allowEmpty: true, placeholder: "HH:mm", width: 100 }))),
        React.createElement(Field, { label: "Timezone" }, renderTimezone())));
};
const getStyles = (theme) => {
    return {
        wrapper: css({
            maxWidth: theme.spacing(60),
            marginBottom: theme.spacing(2),
        }),
        timezoneContainer: css `
      padding: 5px;
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
    `,
        timezone: css `
      margin-right: 5px;
    `,
    };
};
//# sourceMappingURL=TimeRegionEditor.js.map