import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { CSSTransition } from 'react-transition-group';
import { stylesFactory } from '../../themes';
var getStyles = stylesFactory(function (duration) {
    return {
        enter: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: enter;\n      opacity: 0;\n    "], ["\n      label: enter;\n      opacity: 0;\n    "]))),
        enterActive: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      label: enterActive;\n      opacity: 1;\n      transition: opacity ", "ms ease-out;\n    "], ["\n      label: enterActive;\n      opacity: 1;\n      transition: opacity ", "ms ease-out;\n    "])), duration),
        exit: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      label: exit;\n      opacity: 1;\n    "], ["\n      label: exit;\n      opacity: 1;\n    "]))),
        exitActive: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      label: exitActive;\n      opacity: 0;\n      transition: opacity ", "ms ease-out;\n    "], ["\n      label: exitActive;\n      opacity: 0;\n      transition: opacity ", "ms ease-out;\n    "])), duration),
    };
});
export function FadeTransition(props) {
    var visible = props.visible, children = props.children, _a = props.duration, duration = _a === void 0 ? 250 : _a;
    var styles = getStyles(duration);
    return (React.createElement(CSSTransition, { in: visible, mountOnEnter: true, unmountOnExit: true, timeout: duration, classNames: styles }, children));
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=FadeTransition.js.map