import { cx } from '@emotion/css';
import React, { useState } from 'react';
import { useStyles2 } from '@grafana/ui';
import { Icon } from '../Icon';
import { getStyles } from './Chip.styles';
export const Chip = ({ text, isRemovable = false, onRemove = () => null, className }) => {
    const styles = useStyles2(getStyles);
    const [show, setShow] = useState(true);
    const handleCloseClick = () => {
        onRemove(text);
        setShow(false);
    };
    return show ? (React.createElement("div", { "data-testid": "chip", className: cx(styles.wrapper, className) },
        text,
        isRemovable && (React.createElement(Icon, { name: "cross", width: "8px", height: "8px", "data-testid": "chip-remove", onClick: handleCloseClick, className: styles.removeIcon })))) : null;
};
//# sourceMappingURL=Chip.js.map