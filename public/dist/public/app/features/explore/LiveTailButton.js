import { css } from '@emotion/css';
import React from 'react';
import { CSSTransition } from 'react-transition-group';
import { Tooltip, ButtonGroup, ToolbarButton } from '@grafana/ui';
export function LiveTailButton(props) {
    const { start, pause, resume, isLive, isPaused, stop, splitted } = props;
    const buttonVariant = isLive && !isPaused ? 'active' : 'canvas';
    const onClickMain = isLive ? (isPaused ? resume : pause) : start;
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
const styles = {
    stopButtonEnter: css `
    label: stopButtonEnter;
    width: 0;
    opacity: 0;
    overflow: hidden;
  `,
    stopButtonEnterActive: css `
    label: stopButtonEnterActive;
    opacity: 1;
    width: 32px;
  `,
    stopButtonExit: css `
    label: stopButtonExit;
    width: 32px;
    opacity: 1;
    overflow: hidden;
  `,
    stopButtonExitActive: css `
    label: stopButtonExitActive;
    opacity: 0;
    width: 0;
  `,
};
//# sourceMappingURL=LiveTailButton.js.map