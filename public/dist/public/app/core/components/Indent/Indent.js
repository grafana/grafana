import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { getResponsiveStyle } from '@grafana/ui/src/components/Layout/utils/responsiveness';
export function Indent({ children, spacing, level }) {
    const styles = useStyles2(getStyles, spacing, level);
    return React.createElement("span", { className: css(styles.indentor) }, children);
}
const getStyles = (theme, spacing, level) => ({
    indentor: css(getResponsiveStyle(theme, spacing, (val) => ({
        paddingLeft: theme.spacing(val * level),
    }))),
});
//# sourceMappingURL=Indent.js.map