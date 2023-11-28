import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { getStyles } from './EmptyBlock.styles';
export const EmptyBlock = ({ children, dataTestId }) => {
    const style = useStyles2(getStyles);
    return (React.createElement("div", { className: style.emptyBlockWrapper, "data-testid": dataTestId }, children));
};
//# sourceMappingURL=EmptyBlock.js.map