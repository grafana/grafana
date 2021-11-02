import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { CSSTransition } from 'react-transition-group';
import { Tooltip, ButtonGroup, ToolbarButton } from '@grafana/ui';
export function LiveTailButton(props) {
    var start = props.start, pause = props.pause, resume = props.resume, isLive = props.isLive, isPaused = props.isPaused, stop = props.stop, splitted = props.splitted;
    var buttonVariant = isLive && !isPaused ? 'active' : 'default';
    var onClickMain = isLive ? (isPaused ? resume : pause) : start;
    return (React.createElement(ButtonGroup, null,
        React.createElement(Tooltip, { content: isLive && !isPaused ? React.createElement(React.Fragment, null, "Pause the live stream") : React.createElement(React.Fragment, null, "Start live stream your logs"), placement: "bottom" },
            React.createElement(ToolbarButton, { iconOnly: splitted, variant: buttonVariant, icon: !isLive || isPaused ? 'play' : 'pause', onClick: onClickMain }, isLive && isPaused ? 'Paused' : 'Live')),
        React.createElement(CSSTransition, { mountOnEnter: true, unmountOnExit: true, timeout: 100, in: isLive, classNames: {
                enter: styles.stopButtonEnter,
                enterActive: styles.stopButtonEnterActive,
                exit: styles.stopButtonExit,
                exitActive: styles.stopButtonExitActive,
            } },
            React.createElement(Tooltip, { content: React.createElement(React.Fragment, null, "Stop and exit the live stream"), placement: "bottom" },
                React.createElement(ToolbarButton, { variant: buttonVariant, onClick: stop, icon: "square-shape" })))));
}
var styles = {
    stopButtonEnter: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    label: stopButtonEnter;\n    width: 0;\n    opacity: 0;\n    overflow: hidden;\n  "], ["\n    label: stopButtonEnter;\n    width: 0;\n    opacity: 0;\n    overflow: hidden;\n  "]))),
    stopButtonEnterActive: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    label: stopButtonEnterActive;\n    opacity: 1;\n    width: 32px;\n  "], ["\n    label: stopButtonEnterActive;\n    opacity: 1;\n    width: 32px;\n  "]))),
    stopButtonExit: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    label: stopButtonExit;\n    width: 32px;\n    opacity: 1;\n    overflow: hidden;\n  "], ["\n    label: stopButtonExit;\n    width: 32px;\n    opacity: 1;\n    overflow: hidden;\n  "]))),
    stopButtonExitActive: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    label: stopButtonExitActive;\n    opacity: 0;\n    width: 0;\n  "], ["\n    label: stopButtonExitActive;\n    opacity: 0;\n    width: 0;\n  "]))),
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=LiveTailButton.js.map