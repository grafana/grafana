import { __assign } from "tslib";
import React, { useLayoutEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useTheme2 } from '../../themes';
export function Portal(props) {
    var children = props.children, className = props.className, _a = props.root, portalRoot = _a === void 0 ? document.body : _a, forwardedRef = props.forwardedRef;
    var theme = useTheme2();
    var node = useRef(null);
    if (!node.current) {
        node.current = document.createElement('div');
        if (className) {
            node.current.className = className;
        }
        node.current.style.position = 'relative';
        node.current.style.zIndex = "" + theme.zIndex.portal;
    }
    useLayoutEffect(function () {
        if (node.current) {
            portalRoot.appendChild(node.current);
        }
        return function () {
            if (node.current) {
                portalRoot.removeChild(node.current);
            }
        };
    }, [portalRoot]);
    return ReactDOM.createPortal(React.createElement("div", { ref: forwardedRef }, children), node.current);
}
export var RefForwardingPortal = React.forwardRef(function (props, ref) {
    return React.createElement(Portal, __assign({}, props, { forwardedRef: ref }));
});
RefForwardingPortal.displayName = 'RefForwardingPortal';
//# sourceMappingURL=Portal.js.map