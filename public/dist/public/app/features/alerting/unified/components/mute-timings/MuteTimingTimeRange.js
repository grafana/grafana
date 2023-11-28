import { css } from '@emotion/css';
import React from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button, Field, Icon, IconButton, InlineField, InlineFieldRow, Input, useStyles2 } from '@grafana/ui';
import { isValidStartAndEndTime, isvalidTimeFormat } from './util';
const INVALID_FORMAT_MESSAGE = 'Times must be between 00:00 and 24:00 UTC';
export const MuteTimingTimeRange = ({ intervalIndex }) => {
    var _a, _b, _c;
    const styles = useStyles2(getStyles);
    const { register, formState, getValues } = useFormContext();
    const { fields: timeRanges, append: addTimeRange, remove: removeTimeRange, } = useFieldArray({
        name: `time_intervals.${intervalIndex}.times`,
    });
    const formErrors = (_a = formState.errors.time_intervals) === null || _a === void 0 ? void 0 : _a[intervalIndex];
    const timeRangeInvalid = (_c = (_b = formErrors === null || formErrors === void 0 ? void 0 : formErrors.times) === null || _b === void 0 ? void 0 : _b.some((value) => (value === null || value === void 0 ? void 0 : value.start_time) || (value === null || value === void 0 ? void 0 : value.end_time))) !== null && _c !== void 0 ? _c : false;
    return (React.createElement("div", null,
        React.createElement(Field, { className: styles.field, label: "Time range", description: "The time inclusive of the starting time and exclusive of the end time in UTC", invalid: timeRangeInvalid },
            React.createElement(React.Fragment, null, timeRanges.map((timeRange, index) => {
                var _a, _b, _c;
                const timeRangeErrors = (_a = formErrors === null || formErrors === void 0 ? void 0 : formErrors.times) === null || _a === void 0 ? void 0 : _a[index];
                const startTimeKey = `time_intervals.${intervalIndex}.times.${index}.start_time`;
                const endTimeKey = `time_intervals.${intervalIndex}.times.${index}.end_time`;
                const getStartAndEndTime = () => {
                    // @ts-ignore react-hook-form doesn't handle nested field arrays well
                    const startTime = getValues(startTimeKey);
                    // @ts-ignore react-hook-form doesn't handle nested field arrays well
                    const endTime = getValues(endTimeKey);
                    return [startTime, endTime];
                };
                return (React.createElement("div", { className: styles.timeRange, key: timeRange.id },
                    React.createElement(InlineFieldRow, null,
                        React.createElement(InlineField, { label: "Start time", invalid: Boolean(timeRangeErrors === null || timeRangeErrors === void 0 ? void 0 : timeRangeErrors.start_time), error: (_b = timeRangeErrors === null || timeRangeErrors === void 0 ? void 0 : timeRangeErrors.start_time) === null || _b === void 0 ? void 0 : _b.message },
                            React.createElement(Input
                            // @ts-ignore
                            , Object.assign({}, register(startTimeKey, {
                                validate: (input) => {
                                    const validFormat = isvalidTimeFormat(input);
                                    if (!validFormat) {
                                        return INVALID_FORMAT_MESSAGE;
                                    }
                                    const [startTime, endTime] = getStartAndEndTime();
                                    if (isValidStartAndEndTime(startTime, endTime)) {
                                        return;
                                    }
                                    else {
                                        return 'Start time must be before end time';
                                    }
                                },
                            }), { className: styles.timeRangeInput, maxLength: 5, suffix: React.createElement(Icon, { name: "clock-nine" }), 
                                // @ts-ignore react-hook-form doesn't handle nested field arrays well
                                defaultValue: timeRange.start_time, placeholder: "HH:mm", "data-testid": "mute-timing-starts-at" }))),
                        React.createElement(InlineField, { label: "End time", invalid: Boolean(timeRangeErrors === null || timeRangeErrors === void 0 ? void 0 : timeRangeErrors.end_time), error: (_c = timeRangeErrors === null || timeRangeErrors === void 0 ? void 0 : timeRangeErrors.end_time) === null || _c === void 0 ? void 0 : _c.message },
                            React.createElement(Input, Object.assign({}, register(`time_intervals.${intervalIndex}.times.${index}.end_time`, {
                                validate: (input) => {
                                    const validFormat = isvalidTimeFormat(input);
                                    if (!validFormat) {
                                        return INVALID_FORMAT_MESSAGE;
                                    }
                                    const [startTime, endTime] = getStartAndEndTime();
                                    if (isValidStartAndEndTime(startTime, endTime)) {
                                        return;
                                    }
                                    else {
                                        return 'End time must be after start time';
                                    }
                                },
                            }), { className: styles.timeRangeInput, maxLength: 5, suffix: React.createElement(Icon, { name: "clock-nine" }), 
                                // @ts-ignore react-hook-form doesn't handle nested field arrays well
                                defaultValue: timeRange.end_time, placeholder: "HH:mm", "data-testid": "mute-timing-ends-at" }))),
                        React.createElement(IconButton, { className: styles.deleteTimeRange, title: "Remove", name: "trash-alt", onClick: (e) => {
                                e.preventDefault();
                                removeTimeRange(index);
                            }, tooltip: "Remove time range" }))));
            }))),
        React.createElement(Button, { className: styles.addTimeRange, variant: "secondary", type: "button", icon: "plus", onClick: () => addTimeRange({ start_time: '', end_time: '' }) }, "Add another time range")));
};
const getStyles = (theme) => ({
    field: css `
    margin-bottom: 0;
  `,
    timeRange: css `
    margin-bottom: ${theme.spacing(1)};
  `,
    timeRangeInput: css `
    width: 90px;
  `,
    deleteTimeRange: css `
    margin: ${theme.spacing(1)} 0 0 ${theme.spacing(0.5)};
  `,
    addTimeRange: css `
    margin-bottom: ${theme.spacing(2)};
  `,
});
//# sourceMappingURL=MuteTimingTimeRange.js.map