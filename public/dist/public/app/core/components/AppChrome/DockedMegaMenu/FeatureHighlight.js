import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
export const FeatureHighlight = ({ children }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", null,
        children,
        React.createElement("span", { className: styles.highlight })));
};
const getStyles = (theme) => {
    return {
        highlight: css({
            backgroundColor: theme.colors.success.main,
            borderRadius: theme.shape.radius.circle,
            width: '6px',
            height: '6px',
            display: 'inline-block;',
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
        }),
    };
};
//# sourceMappingURL=FeatureHighlight.js.map