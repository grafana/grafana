import React from 'react';
import { Cross, DisabledSquare, EnabledSquare, MinusSquare, PlusSquare } from './icons';
// TODO: improve this mapping
const icons = {
    plusSquare: PlusSquare,
    minusSquare: MinusSquare,
    selectedSquare: EnabledSquare,
    unselectedSquare: DisabledSquare,
    cross: Cross,
};
export const Icon = (props) => {
    // eslint-disable-next-line react/destructuring-assignment
    const IconComponent = icons[props.name];
    return React.createElement(IconComponent, Object.assign({}, props));
};
//# sourceMappingURL=Icon.js.map