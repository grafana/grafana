import { __makeTemplateObject } from "tslib";
import { css } from '@emotion/css';
import { dateTime } from '@grafana/data';
import { Field, TimeRangeInput, useStyles } from '@grafana/ui';
import React from 'react';
import { useController, useFormContext } from 'react-hook-form';
export var SilencePeriod = function () {
    var _a = useFormContext(), control = _a.control, getValues = _a.getValues;
    var styles = useStyles(getStyles);
    var _b = useController({
        name: 'startsAt',
        control: control,
        rules: {
            validate: function (value) { return getValues().endsAt > value; },
        },
    }), _c = _b.field, onChangeStartsAt = _c.onChange, startsAt = _c.value, startsAtInvalid = _b.fieldState.invalid;
    var _d = useController({
        name: 'endsAt',
        control: control,
        rules: {
            validate: function (value) { return getValues().startsAt < value; },
        },
    }), _e = _d.field, onChangeEndsAt = _e.onChange, endsAt = _e.value, endsAtInvalid = _d.fieldState.invalid;
    var _f = useController({
        name: 'timeZone',
        control: control,
    }).field, onChangeTimeZone = _f.onChange, timeZone = _f.value;
    var invalid = startsAtInvalid || endsAtInvalid;
    var from = dateTime(startsAt);
    var to = dateTime(endsAt);
    return (React.createElement(Field, { className: styles.timeRange, label: "Silence start and end", error: invalid ? 'To is before or the same as from' : '', invalid: invalid },
        React.createElement(TimeRangeInput, { value: {
                from: from,
                to: to,
                raw: {
                    from: from,
                    to: to,
                },
            }, timeZone: timeZone, onChange: function (newValue) {
                onChangeStartsAt(dateTime(newValue.from));
                onChangeEndsAt(dateTime(newValue.to));
            }, onChangeTimeZone: function (newValue) { return onChangeTimeZone(newValue); }, hideTimeZone: false, hideQuickRanges: true, placeholder: 'Select time range' })));
};
var getStyles = function (theme) { return ({
    timeRange: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    width: 400px;\n  "], ["\n    width: 400px;\n  "]))),
}); };
var templateObject_1;
//# sourceMappingURL=SilencePeriod.js.map