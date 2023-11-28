import { cx } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { getStyles } from './DetailsRow.styles';
export const DetailsRowContent = ({ title, fullRow, children }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("span", { className: cx(styles.rowContentWrapper, fullRow && styles.fullRowContent), "data-testid": "details-row-content" },
        React.createElement("span", null, title),
        React.createElement("div", null, children)));
};
//# sourceMappingURL=DetailsRowContent.js.map