import React, { useRef } from 'react';
import { Popover as GrafanaPopover, PopoverController } from '@grafana/ui';
export function Popover({ children, content, overlayClassName }) {
    const popoverRef = useRef(null);
    return (React.createElement(PopoverController, { content: content, hideAfter: 300 }, (showPopper, hidePopper, popperProps) => {
        return (React.createElement(React.Fragment, null,
            popoverRef.current && (React.createElement(GrafanaPopover, Object.assign({}, popperProps, { referenceElement: popoverRef.current, wrapperClassName: overlayClassName, onMouseLeave: hidePopper, onMouseEnter: showPopper }))),
            React.cloneElement(children, {
                ref: popoverRef,
                onMouseEnter: showPopper,
                onMouseLeave: hidePopper,
            })));
    }));
}
//# sourceMappingURL=Popover.js.map