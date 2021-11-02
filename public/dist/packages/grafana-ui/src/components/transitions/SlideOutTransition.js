import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { CSSTransition } from 'react-transition-group';
import { stylesFactory } from '../../themes';
var getStyles = stylesFactory(function (duration, measurement, size) {
    return {
        enter: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: enter;\n      ", ": 0;\n      opacity: 0;\n    "], ["\n      label: enter;\n      ", ": 0;\n      opacity: 0;\n    "])), measurement),
        enterActive: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      label: enterActive;\n      ", ": ", "px;\n      opacity: 1;\n      transition: opacity ", "ms ease-out, ", " ", "ms ease-out;\n    "], ["\n      label: enterActive;\n      ", ": ", "px;\n      opacity: 1;\n      transition: opacity ", "ms ease-out, ", " ", "ms ease-out;\n    "])), measurement, size, duration, measurement, duration),
        exit: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      label: exit;\n      ", ": ", "px;\n      opacity: 1;\n    "], ["\n      label: exit;\n      ", ": ", "px;\n      opacity: 1;\n    "])), measurement, size),
        exitActive: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      label: exitActive;\n      opacity: 0;\n      ", ": 0;\n      transition: opacity ", "ms ease-out, ", " ", "ms ease-out;\n    "], ["\n      label: exitActive;\n      opacity: 0;\n      ", ": 0;\n      transition: opacity ", "ms ease-out, ", " ", "ms ease-out;\n    "])), measurement, duration, measurement, duration),
    };
});
export function SlideOutTransition(props) {
    var visible = props.visible, children = props.children, _a = props.duration, duration = _a === void 0 ? 250 : _a, horizontal = props.horizontal, size = props.size;
    var styles = getStyles(duration, horizontal ? 'width' : 'height', size);
    return (React.createElement(CSSTransition, { in: visible, mountOnEnter: true, unmountOnExit: true, timeout: duration, classNames: styles }, children));
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=SlideOutTransition.js.map