import React from 'react';
import { IconButton, useStyles2 } from '@grafana/ui';
import { getStyles } from './Close.styles';
const Close = ({ onClick }) => {
    const styles = useStyles2(getStyles);
    return React.createElement(IconButton, { "aria-label": 'Close tour', className: styles.button, onClick: onClick, name: "times", size: "lg" });
};
export default Close;
//# sourceMappingURL=Close.js.map