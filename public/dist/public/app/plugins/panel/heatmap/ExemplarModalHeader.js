import React from 'react';
import { CloseButton } from '../../../core/components/CloseButton/CloseButton';
export function ExemplarModalHeader(props) {
    return (React.createElement("div", { style: {
            width: '100%',
            display: 'flex',
            justifyContent: 'flex-end',
            paddingBottom: '6px',
        } },
        React.createElement(CloseButton, { onClick: props.onClick, style: {
                position: 'relative',
                top: 'auto',
                right: 'auto',
                marginRight: 0,
            } })));
}
//# sourceMappingURL=ExemplarModalHeader.js.map