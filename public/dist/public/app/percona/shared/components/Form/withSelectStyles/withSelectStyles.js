/* eslint-disable react/display-name */
import React from 'react';
import { useStyles } from '@grafana/ui';
import { getStyles } from './withSelectStyles.styles';
export const withSelectStyles = (Component) => (props) => {
    const styles = useStyles(getStyles);
    return React.createElement(Component, Object.assign({ className: styles.select }, props));
};
//# sourceMappingURL=withSelectStyles.js.map