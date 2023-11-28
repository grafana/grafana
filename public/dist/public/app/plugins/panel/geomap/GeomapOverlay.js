import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
export const GeomapOverlay = ({ topRight1, topRight2, bottomLeft, blStyle }) => {
    var _a;
    const topRight1Exists = (_a = (topRight1 && topRight1.length > 0)) !== null && _a !== void 0 ? _a : false;
    const styles = useStyles2(getStyles(topRight1Exists));
    return (React.createElement("div", { className: styles.overlay },
        Boolean(topRight1 === null || topRight1 === void 0 ? void 0 : topRight1.length) && React.createElement("div", { className: styles.TR1 }, topRight1),
        Boolean(topRight2 === null || topRight2 === void 0 ? void 0 : topRight2.length) && React.createElement("div", { className: styles.TR2 }, topRight2),
        Boolean(bottomLeft === null || bottomLeft === void 0 ? void 0 : bottomLeft.length) && (React.createElement("div", { className: styles.BL, style: blStyle }, bottomLeft))));
};
const getStyles = (topRight1Exists) => (theme) => ({
    overlay: css({
        position: 'absolute',
        width: '100%',
        height: '100%',
        zIndex: 500,
        pointerEvents: 'none',
    }),
    TR1: css({
        right: '0.5em',
        pointerEvents: 'auto',
        position: 'absolute',
        top: '0.5em',
    }),
    TR2: css({
        position: 'absolute',
        top: topRight1Exists ? '80px' : '8px',
        right: '8px',
        pointerEvents: 'auto',
    }),
    BL: css({
        position: 'absolute',
        bottom: '8px',
        left: '8px',
        pointerEvents: 'auto',
    }),
});
//# sourceMappingURL=GeomapOverlay.js.map