import { __makeTemplateObject } from "tslib";
import React from 'react';
import memoizeOne from 'memoize-one';
import { css } from '@emotion/css';
import { CSSTransition } from 'react-transition-group';
var transitionDuration = 500;
// We add a bit of delay to the transition as another perf optimisation. As at the start we need to render
// quite a bit of new rows, if we start transition at the same time there can be frame rate drop. This gives time
// for react to first render them and then do the animation.
var transitionDelay = 100;
var getStyles = memoizeOne(function () {
    return {
        logsEnter: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      label: logsEnter;\n      position: absolute;\n      opacity: 0;\n      height: auto;\n      width: 100%;\n    "], ["\n      label: logsEnter;\n      position: absolute;\n      opacity: 0;\n      height: auto;\n      width: 100%;\n    "]))),
        logsEnterActive: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      label: logsEnterActive;\n      opacity: 1;\n      transition: opacity ", "ms ease-out ", "ms;\n    "], ["\n      label: logsEnterActive;\n      opacity: 1;\n      transition: opacity ", "ms ease-out ", "ms;\n    "])), transitionDuration, transitionDelay),
        logsExit: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      label: logsExit;\n      position: absolute;\n      opacity: 1;\n      height: auto;\n      width: 100%;\n    "], ["\n      label: logsExit;\n      position: absolute;\n      opacity: 1;\n      height: auto;\n      width: 100%;\n    "]))),
        logsExitActive: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      label: logsExitActive;\n      opacity: 0;\n      transition: opacity ", "ms ease-out ", "ms;\n    "], ["\n      label: logsExitActive;\n      opacity: 0;\n      transition: opacity ", "ms ease-out ", "ms;\n    "])), transitionDuration, transitionDelay),
    };
});
/**
 * Cross fade transition component that is tied a bit too much to the logs containers so not very useful elsewhere
 * right now.
 */
export function LogsCrossFadeTransition(props) {
    var visible = props.visible, children = props.children;
    var styles = getStyles();
    return (React.createElement(CSSTransition, { in: visible, mountOnEnter: true, unmountOnExit: true, timeout: transitionDuration + transitionDelay, classNames: {
            enter: styles.logsEnter,
            enterActive: styles.logsEnterActive,
            exit: styles.logsExit,
            exitActive: styles.logsExitActive,
        } }, children));
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=LogsCrossFadeTransition.js.map