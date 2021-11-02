import { __assign, __makeTemplateObject, __read, __rest } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { dateTime } from '@grafana/data';
import { DatePicker } from '../DatePicker/DatePicker';
import { Input } from '../../Input/Input';
import { useStyles } from '../../../themes';
export var formatDate = function (date) { return dateTime(date).format('L'); };
/** @public */
export var DatePickerWithInput = function (_a) {
    var value = _a.value, onChange = _a.onChange, closeOnSelect = _a.closeOnSelect, _b = _a.placeholder, placeholder = _b === void 0 ? 'Date' : _b, rest = __rest(_a, ["value", "onChange", "closeOnSelect", "placeholder"]);
    var _c = __read(React.useState(false), 2), open = _c[0], setOpen = _c[1];
    var styles = useStyles(getStyles);
    return (React.createElement("div", { className: styles.container },
        React.createElement(Input, __assign({ type: "text", autoComplete: 'off', placeholder: placeholder, value: value ? formatDate(value) : value, onClick: function () { return setOpen(true); }, onChange: function (ev) {
                // Allow resetting the date
                if (ev.target.value === '') {
                    onChange('');
                }
            }, className: styles.input }, rest)),
        React.createElement(DatePicker, { isOpen: open, value: value && typeof value !== 'string' ? value : dateTime().toDate(), onChange: function (ev) {
                onChange(ev);
                if (closeOnSelect) {
                    setOpen(false);
                }
            }, onClose: function () { return setOpen(false); } })));
};
var getStyles = function () {
    return {
        container: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      position: relative;\n    "], ["\n      position: relative;\n    "]))),
        input: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    /* hides the native Calendar picker icon given when using type=date */\n    input[type='date']::-webkit-inner-spin-button,\n    input[type='date']::-webkit-calendar-picker-indicator {\n    display: none;\n    -webkit-appearance: none;\n    "], ["\n    /* hides the native Calendar picker icon given when using type=date */\n    input[type='date']::-webkit-inner-spin-button,\n    input[type='date']::-webkit-calendar-picker-indicator {\n    display: none;\n    -webkit-appearance: none;\n    "]))),
    };
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=DatePickerWithInput.js.map