import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { Stack } from './Stack';
export const EditorRow = ({ children, stackProps }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.root },
        React.createElement(Stack, Object.assign({ gap: 2 }, stackProps), children)));
};
const getStyles = (theme) => {
    return {
        root: css({
            padding: theme.spacing(1),
            backgroundColor: theme.colors.background.secondary,
            borderRadius: theme.shape.radius.default,
        }),
    };
};
//# sourceMappingURL=EditorRow.js.map