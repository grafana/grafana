import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { getStyles } from './DetailsRow.styles';
import { DetailsRowContent } from './DetailsRowContent';
export const DetailsRow = ({ children }) => {
    const styles = useStyles2(getStyles);
    return React.createElement("div", { className: styles.row }, children);
};
DetailsRow.Contents = DetailsRowContent;
//# sourceMappingURL=DetailsRow.js.map