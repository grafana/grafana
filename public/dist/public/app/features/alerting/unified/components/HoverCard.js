import { __rest } from "tslib";
import { css } from '@emotion/css';
import classnames from 'classnames';
import React, { useRef } from 'react';
import { Stack } from '@grafana/experimental';
import { Popover as GrafanaPopover, PopoverController, useStyles2 } from '@grafana/ui';
export const HoverCard = (_a) => {
    var { children, header, content, footer, arrow, showAfter = 300, wrapperClassName, disabled = false } = _a, rest = __rest(_a, ["children", "header", "content", "footer", "arrow", "showAfter", "wrapperClassName", "disabled"]);
    const popoverRef = useRef(null);
    const styles = useStyles2(getStyles);
    if (disabled) {
        return children;
    }
    const body = (React.createElement(Stack, { direction: "column", gap: 0 },
        header && React.createElement("div", { className: styles.card.header }, header),
        React.createElement("div", { className: styles.card.body }, content),
        footer && React.createElement("div", { className: styles.card.footer }, footer)));
    return (React.createElement(PopoverController, { content: body, hideAfter: 100 }, (showPopper, hidePopper, popperProps) => {
        return (React.createElement(React.Fragment, null,
            popoverRef.current && (React.createElement(GrafanaPopover, Object.assign({}, popperProps, rest, { wrapperClassName: classnames(styles.popover(arrow ? 1.25 : 0), wrapperClassName), onMouseLeave: hidePopper, onMouseEnter: showPopper, onFocus: showPopper, onBlur: hidePopper, referenceElement: popoverRef.current, renderArrow: arrow
                    ? ({ arrowProps, placement }) => React.createElement("div", Object.assign({ className: styles.arrow(placement) }, arrowProps))
                    : () => React.createElement(React.Fragment, null) }))),
            React.cloneElement(children, {
                ref: popoverRef,
                onMouseEnter: showPopper,
                onMouseLeave: hidePopper,
                onFocus: showPopper,
                onBlur: hidePopper,
            })));
    }));
};
const getStyles = (theme) => ({
    popover: (offset) => css `
    border-radius: ${theme.shape.radius.default};
    box-shadow: ${theme.shadows.z3};
    background: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.medium};

    margin-bottom: ${theme.spacing(offset)};
  `,
    card: {
        body: css `
      padding: ${theme.spacing(1)};
    `,
        header: css `
      padding: ${theme.spacing(1)};
      background: ${theme.colors.background.secondary};
      border-bottom: solid 1px ${theme.colors.border.medium};
    `,
        footer: css `
      padding: ${theme.spacing(0.5)} ${theme.spacing(1)};
      background: ${theme.colors.background.secondary};
      border-top: solid 1px ${theme.colors.border.medium};
    `,
    },
    // TODO currently only works with bottom placement
    arrow: (placement) => {
        const ARROW_SIZE = '9px';
        return css `
      width: 0;
      height: 0;

      border-left: ${ARROW_SIZE} solid transparent;
      border-right: ${ARROW_SIZE} solid transparent;
      /* using hex colors here because the border colors use alpha transparency */
      border-top: ${ARROW_SIZE} solid ${theme.isLight ? '#d2d3d4' : '#2d3037'};

      &:after {
        content: '';
        position: absolute;

        border: ${ARROW_SIZE} solid ${theme.colors.background.primary};
        border-bottom: 0;
        border-left-color: transparent;
        border-right-color: transparent;

        margin-top: 1px;
        bottom: 1px;
        left: -${ARROW_SIZE};
      }
    `;
    },
});
//# sourceMappingURL=HoverCard.js.map