import { css, cx } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
export function NavToolbarSeparator({ className, leftActionsSeparator }) {
    const styles = useStyles2(getStyles);
    if (leftActionsSeparator) {
        return React.createElement("div", { className: cx(className, styles.leftActionsSeparator) });
    }
    return React.createElement("div", { className: cx(className, styles.line) });
}
const getStyles = (theme) => {
    return {
        leftActionsSeparator: css({
            display: 'flex',
            flexGrow: 1,
        }),
        line: css({
            width: 1,
            backgroundColor: theme.colors.border.medium,
            height: 24,
        }),
    };
};
//# sourceMappingURL=NavToolbarSeparator.js.map