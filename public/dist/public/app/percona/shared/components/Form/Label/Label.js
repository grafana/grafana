import React from 'react';
import { useStyles } from '@grafana/ui';
import { getStyles } from './Label.styles';
export const Label = ({ label, dataTestId }) => {
    const styles = useStyles(getStyles);
    return (React.createElement("label", { className: styles.label, "data-testid": dataTestId }, label));
};
//# sourceMappingURL=Label.js.map