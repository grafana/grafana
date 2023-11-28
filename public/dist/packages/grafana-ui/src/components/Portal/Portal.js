import React, { useLayoutEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useTheme2 } from '../../themes';
export function Portal(props) {
    const { children, className, root, forwardedRef } = props;
    const theme = useTheme2();
    const node = useRef(null);
    const portalRoot = root !== null && root !== void 0 ? root : getPortalContainer();
    if (!node.current) {
        node.current = document.createElement('div');
        if (className) {
            node.current.className = className;
        }
        node.current.style.position = 'relative';
        node.current.style.zIndex = `${theme.zIndex.portal}`;
    }
    useLayoutEffect(() => {
        if (node.current) {
            portalRoot.appendChild(node.current);
        }
        return () => {
            if (node.current) {
                portalRoot.removeChild(node.current);
            }
        };
    }, [portalRoot]);
    return ReactDOM.createPortal(React.createElement("div", { style: { zIndex: 1061, position: 'relative' }, ref: forwardedRef }, children), node.current);
}
/** @internal */
export function getPortalContainer() {
    var _a;
    return (_a = window.document.getElementById('grafana-portal-container')) !== null && _a !== void 0 ? _a : document.body;
}
/** @internal */
export function PortalContainer() {
    return React.createElement("div", { id: "grafana-portal-container" });
}
export const RefForwardingPortal = React.forwardRef((props, ref) => {
    return React.createElement(Portal, Object.assign({}, props, { forwardedRef: ref }));
});
RefForwardingPortal.displayName = 'RefForwardingPortal';
//# sourceMappingURL=Portal.js.map