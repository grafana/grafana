import { css } from '@emotion/css';
import React from 'react';
import { Stack } from '@grafana/experimental';
import { useStyles2 } from '@grafana/ui';
export function OperationsEditorRow({ children }) {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.root },
        React.createElement(Stack, { gap: 1 }, children)));
}
const getStyles = (theme) => {
    return {
        root: css({
            padding: theme.spacing(1, 1, 0, 1),
            backgroundColor: theme.colors.background.secondary,
            borderRadius: theme.shape.radius.default,
        }),
    };
};
//# sourceMappingURL=OperationsEditorRow.js.map