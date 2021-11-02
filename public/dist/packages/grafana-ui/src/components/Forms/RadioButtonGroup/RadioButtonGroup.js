import { __makeTemplateObject } from "tslib";
import React, { useCallback, useRef } from 'react';
import { css, cx } from '@emotion/css';
import { uniqueId } from 'lodash';
import { RadioButton } from './RadioButton';
import { Icon } from '../../Icon/Icon';
import { useStyles2 } from '../../../themes';
export function RadioButtonGroup(_a) {
    var options = _a.options, value = _a.value, onChange = _a.onChange, disabled = _a.disabled, disabledOptions = _a.disabledOptions, _b = _a.size, size = _b === void 0 ? 'md' : _b, className = _a.className, _c = _a.fullWidth, fullWidth = _c === void 0 ? false : _c;
    var handleOnChange = useCallback(function (option) {
        return function () {
            if (onChange) {
                onChange(option.value);
            }
        };
    }, [onChange]);
    var id = uniqueId('radiogroup-');
    var groupName = useRef(id);
    var styles = useStyles2(getStyles);
    return (React.createElement("div", { className: cx(styles.radioGroup, fullWidth && styles.fullWidth, className) }, options.map(function (o, i) {
        var isItemDisabled = disabledOptions && o.value && disabledOptions.includes(o.value);
        return (React.createElement(RadioButton, { size: size, disabled: isItemDisabled || disabled, active: value === o.value, key: "o.label-" + i, "aria-label": o.ariaLabel, onChange: handleOnChange(o), id: "option-" + o.value + "-" + id, name: groupName.current, description: o.description, fullWidth: fullWidth },
            o.icon && React.createElement(Icon, { name: o.icon, className: styles.icon }),
            o.imgUrl && React.createElement("img", { src: o.imgUrl, alt: o.label, className: styles.img }),
            o.label));
    })));
}
RadioButtonGroup.displayName = 'RadioButtonGroup';
var getStyles = function (theme) {
    return {
        radioGroup: css({
            display: 'inline-flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            border: "1px solid " + theme.components.input.borderColor,
            borderRadius: theme.shape.borderRadius(),
            padding: '2px',
        }),
        fullWidth: css({
            display: 'flex',
        }),
        icon: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-right: 6px;\n    "], ["\n      margin-right: 6px;\n    "]))),
        img: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      width: ", ";\n      height: ", ";\n      margin-right: ", ";\n    "], ["\n      width: ", ";\n      height: ", ";\n      margin-right: ", ";\n    "])), theme.spacing(2), theme.spacing(2), theme.spacing(1)),
    };
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=RadioButtonGroup.js.map