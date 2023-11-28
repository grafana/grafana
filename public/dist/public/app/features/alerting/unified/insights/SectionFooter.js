import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
export function SectionFooter({ children }) {
    const styles = useStyles2(getStyles);
    return React.createElement("div", { className: styles.sectionFooter }, children && React.createElement("div", null, children));
}
const getStyles = (theme) => ({
    sectionFooter: css({
        marginBottom: theme.spacing(2),
    }),
});
//# sourceMappingURL=SectionFooter.js.map