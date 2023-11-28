import React, { useCallback, useEffect } from 'react';
import { usePopperTooltip } from 'react-popper-tooltip';
import { selectors } from '@grafana/e2e-selectors';
import { useStyles2 } from '../../themes/ThemeContext';
import { buildTooltipTheme } from '../../utils/tooltipUtils';
import { Portal } from '../Portal/Portal';
export const Tooltip = React.forwardRef(({ children, theme, interactive, show, placement, content }, forwardedRef) => {
    const [controlledVisible, setControlledVisible] = React.useState(show);
    useEffect(() => {
        if (controlledVisible !== false) {
            const handleKeyDown = (enterKey) => {
                if (enterKey.key === 'Escape') {
                    setControlledVisible(false);
                }
            };
            document.addEventListener('keydown', handleKeyDown);
            return () => {
                document.removeEventListener('keydown', handleKeyDown);
            };
        }
        else {
            return;
        }
    }, [controlledVisible]);
    const { getArrowProps, getTooltipProps, setTooltipRef, setTriggerRef, visible, update } = usePopperTooltip({
        visible: show !== null && show !== void 0 ? show : controlledVisible,
        placement: placement,
        interactive: interactive,
        delayHide: interactive ? 100 : 0,
        delayShow: 150,
        offset: [0, 8],
        trigger: ['hover', 'focus'],
        onVisibleChange: setControlledVisible,
    });
    const styles = useStyles2(getStyles);
    const style = styles[theme !== null && theme !== void 0 ? theme : 'info'];
    const handleRef = useCallback((ref) => {
        setTriggerRef(ref);
        if (typeof forwardedRef === 'function') {
            forwardedRef(ref);
        }
        else if (forwardedRef) {
            forwardedRef.current = ref;
        }
    }, [forwardedRef, setTriggerRef]);
    return (React.createElement(React.Fragment, null,
        React.cloneElement(children, {
            ref: handleRef,
            tabIndex: 0, // tooltip should be keyboard focusable
        }),
        visible && (React.createElement(Portal, null,
            React.createElement("div", Object.assign({ "data-testid": selectors.components.Tooltip.container, ref: setTooltipRef }, getTooltipProps({ className: style.container })),
                React.createElement("div", Object.assign({}, getArrowProps({ className: style.arrow }))),
                typeof content === 'string' && content,
                React.isValidElement(content) && React.cloneElement(content),
                typeof content === 'function' &&
                    update &&
                    content({
                        updatePopperPosition: update,
                    }))))));
});
Tooltip.displayName = 'Tooltip';
export const getStyles = (theme) => {
    const info = buildTooltipTheme(theme, theme.components.tooltip.background, theme.components.tooltip.background, theme.components.tooltip.text, { topBottom: 0.5, rightLeft: 1 });
    const error = buildTooltipTheme(theme, theme.colors.error.main, theme.colors.error.main, theme.colors.error.contrastText, { topBottom: 0.5, rightLeft: 1 });
    return {
        info,
        ['info-alt']: info,
        error,
    };
};
//# sourceMappingURL=Tooltip.js.map