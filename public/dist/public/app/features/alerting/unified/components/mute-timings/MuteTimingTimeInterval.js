import { css, cx } from '@emotion/css';
import { concat, uniq, upperFirst, without } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Stack } from '@grafana/experimental';
import { Button, Field, FieldSet, Icon, Input, useStyles2 } from '@grafana/ui';
import { DAYS_OF_THE_WEEK, defaultTimeInterval, MONTHS, validateArrayField } from '../../utils/mute-timings';
import { MuteTimingTimeRange } from './MuteTimingTimeRange';
import { TimezoneSelect } from './timezones';
export const MuteTimingTimeInterval = () => {
    const styles = useStyles2(getStyles);
    const { formState, register, setValue } = useFormContext();
    const { fields: timeIntervals, append: addTimeInterval, remove: removeTimeInterval, } = useFieldArray({
        name: 'time_intervals',
    });
    return (React.createElement(FieldSet, { label: "Time intervals" },
        React.createElement(React.Fragment, null,
            React.createElement("p", null, "A time interval is a definition for a moment in time. All fields are lists, and at least one list element must be satisfied to match the field. If a field is left blank, any moment of time will match the field. For an instant of time to match a complete time interval, all fields must match. A mute timing can contain multiple time intervals."),
            React.createElement(Stack, { direction: "column", gap: 2 }, timeIntervals.map((timeInterval, timeIntervalIndex) => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
                const errors = formState.errors;
                // manually register the "location" field, react-hook-form doesn't handle nested field arrays well and will refuse to set
                // the default value for the field when using "useFieldArray"
                register(`time_intervals.${timeIntervalIndex}.location`);
                return (React.createElement("div", { key: timeInterval.id, className: styles.timeIntervalSection },
                    React.createElement(MuteTimingTimeRange, { intervalIndex: timeIntervalIndex }),
                    React.createElement(Field, { label: "Location", invalid: Boolean(errors.location), error: (_a = errors.location) === null || _a === void 0 ? void 0 : _a.message },
                        React.createElement(TimezoneSelect, { prefix: React.createElement(Icon, { name: "map-marker" }), width: 50, onChange: (selectedTimezone) => {
                                setValue(`time_intervals.${timeIntervalIndex}.location`, selectedTimezone.value);
                            }, 
                            // @ts-ignore react-hook-form doesn't handle nested field arrays well
                            defaultValue: { label: timeInterval.location, value: timeInterval.location }, "data-testid": "mute-timing-location" })),
                    React.createElement(Field, { label: "Days of the week" },
                        React.createElement(DaysOfTheWeek, { onChange: (daysOfWeek) => {
                                setValue(`time_intervals.${timeIntervalIndex}.weekdays`, daysOfWeek);
                            }, 
                            // @ts-ignore react-hook-form doesn't handle nested field arrays well
                            defaultValue: timeInterval.weekdays })),
                    React.createElement(Field, { label: "Days of the month", description: "The days of the month, 1-31, of a month. Negative values can be used to represent days which begin at the end of the month", invalid: !!((_c = (_b = errors.time_intervals) === null || _b === void 0 ? void 0 : _b[timeIntervalIndex]) === null || _c === void 0 ? void 0 : _c.days_of_month), error: (_f = (_e = (_d = errors.time_intervals) === null || _d === void 0 ? void 0 : _d[timeIntervalIndex]) === null || _e === void 0 ? void 0 : _e.days_of_month) === null || _f === void 0 ? void 0 : _f.message },
                        React.createElement(Input, Object.assign({}, register(`time_intervals.${timeIntervalIndex}.days_of_month`, {
                            validate: (value) => validateArrayField(value, (day) => {
                                const parsedDay = parseInt(day, 10);
                                return (parsedDay > -31 && parsedDay < 0) || (parsedDay > 0 && parsedDay < 32);
                            }, 'Invalid day'),
                        }), { width: 50, 
                            // @ts-ignore react-hook-form doesn't handle nested field arrays well
                            defaultValue: timeInterval.days_of_month, placeholder: "Example: 1, 14:16, -1", "data-testid": "mute-timing-days" }))),
                    React.createElement(Field, { label: "Months", description: "The months of the year in either numerical or the full calendar month", invalid: !!((_h = (_g = errors.time_intervals) === null || _g === void 0 ? void 0 : _g[timeIntervalIndex]) === null || _h === void 0 ? void 0 : _h.months), error: (_l = (_k = (_j = errors.time_intervals) === null || _j === void 0 ? void 0 : _j[timeIntervalIndex]) === null || _k === void 0 ? void 0 : _k.months) === null || _l === void 0 ? void 0 : _l.message },
                        React.createElement(Input, Object.assign({}, register(`time_intervals.${timeIntervalIndex}.months`, {
                            validate: (value) => validateArrayField(value, (month) => MONTHS.includes(month) || (parseInt(month, 10) < 13 && parseInt(month, 10) > 0), 'Invalid month'),
                        }), { width: 50, placeholder: "Example: 1:3, may:august, december", 
                            // @ts-ignore react-hook-form doesn't handle nested field arrays well
                            defaultValue: timeInterval.months, "data-testid": "mute-timing-months" }))),
                    React.createElement(Field, { label: "Years", invalid: !!((_o = (_m = errors.time_intervals) === null || _m === void 0 ? void 0 : _m[timeIntervalIndex]) === null || _o === void 0 ? void 0 : _o.years), error: (_s = (_r = (_q = (_p = errors.time_intervals) === null || _p === void 0 ? void 0 : _p[timeIntervalIndex]) === null || _q === void 0 ? void 0 : _q.years) === null || _r === void 0 ? void 0 : _r.message) !== null && _s !== void 0 ? _s : '' },
                        React.createElement(Input, Object.assign({}, register(`time_intervals.${timeIntervalIndex}.years`, {
                            validate: (value) => validateArrayField(value, (year) => /^\d{4}$/.test(year), 'Invalid year'),
                        }), { width: 50, placeholder: "Example: 2021:2022, 2030", 
                            // @ts-ignore react-hook-form doesn't handle nested field arrays well
                            defaultValue: timeInterval.years, "data-testid": "mute-timing-years" }))),
                    React.createElement(Button, { type: "button", variant: "destructive", fill: "outline", icon: "trash-alt", onClick: () => removeTimeInterval(timeIntervalIndex) }, "Remove time interval")));
            })),
            React.createElement(Button, { type: "button", variant: "secondary", className: styles.removeTimeIntervalButton, onClick: () => {
                    addTimeInterval(defaultTimeInterval);
                }, icon: "plus" }, "Add another time interval"))));
};
const parseDays = (input) => {
    const parsedDays = input
        .split(',')
        .map((day) => day.trim())
        // each "day" could still be a range of days, so we parse the range
        .flatMap((day) => (day.includes(':') ? parseWeekdayRange(day) : day))
        .map((day) => day.toLowerCase())
        // remove invalid weekdays
        .filter((day) => DAYS_OF_THE_WEEK.includes(day));
    return uniq(parsedDays);
};
// parse monday:wednesday to ["monday", "tuesday", "wednesday"]
function parseWeekdayRange(input) {
    const [start = '', end = ''] = input.split(':');
    const startIndex = DAYS_OF_THE_WEEK.indexOf(start);
    const endIndex = DAYS_OF_THE_WEEK.indexOf(end);
    return DAYS_OF_THE_WEEK.slice(startIndex, endIndex + 1);
}
const DaysOfTheWeek = ({ defaultValue = '', onChange }) => {
    const styles = useStyles2(getStyles);
    const defaultValues = parseDays(defaultValue);
    const [selectedDays, setSelectedDays] = useState(defaultValues);
    const toggleDay = (day) => {
        selectedDays.includes(day)
            ? setSelectedDays((selectedDays) => without(selectedDays, day))
            : setSelectedDays((selectedDays) => concat(selectedDays, day));
    };
    useEffect(() => {
        onChange(selectedDays.join(', '));
    }, [selectedDays, onChange]);
    return (React.createElement("div", { "data-testid": "mute-timing-weekdays" },
        React.createElement(Stack, { gap: 1 }, DAYS_OF_THE_WEEK.map((day) => {
            const style = cx(styles.dayOfTheWeek, selectedDays.includes(day) && 'selected');
            const abbreviated = day.slice(0, 3);
            return (React.createElement("button", { type: "button", key: day, className: style, onClick: () => toggleDay(day) }, upperFirst(abbreviated)));
        }))));
};
const getStyles = (theme) => ({
    input: css `
    width: 400px;
  `,
    timeIntervalSection: css `
    background-color: ${theme.colors.background.secondary};
    padding: ${theme.spacing(2)};
  `,
    removeTimeIntervalButton: css `
    margin-top: ${theme.spacing(2)};
  `,
    dayOfTheWeek: css `
    cursor: pointer;
    user-select: none;
    padding: ${theme.spacing(1)} ${theme.spacing(3)};

    border: solid 1px ${theme.colors.border.medium};
    background: none;
    border-radius: ${theme.shape.radius.default};

    color: ${theme.colors.text.secondary};

    &.selected {
      font-weight: ${theme.typography.fontWeightBold};
      color: ${theme.colors.primary.text};
      border-color: ${theme.colors.primary.border};
      background: ${theme.colors.primary.transparent};
    }
  `,
});
//# sourceMappingURL=MuteTimingTimeInterval.js.map