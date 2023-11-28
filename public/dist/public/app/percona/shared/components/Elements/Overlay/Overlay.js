import { cx } from '@emotion/css';
import React from 'react';
import { Spinner } from '@grafana/ui';
import { styles } from './Overlay.styles';
export const Overlay = ({ children, className, overlayClassName, dataTestId = 'overlay-children', isPending, size = 20, }) => (React.createElement("div", { className: cx(styles.getOverlayWrapper(size), className), "data-testid": "pmm-overlay-wrapper" }, isPending ? (React.createElement(React.Fragment, null,
    React.createElement("div", { className: cx(styles.overlay, overlayClassName), "data-testid": "overlay-spinner" },
        React.createElement(Spinner, { size: size, className: styles.spinner })),
    React.createElement("div", { className: styles.childrenWrapper, "data-testid": dataTestId }, children))) : (children)));
//# sourceMappingURL=Overlay.js.map