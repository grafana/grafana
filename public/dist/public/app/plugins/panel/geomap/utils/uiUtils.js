import { cx } from '@emotion/css';
import React from 'react';
import { isUrl } from './utils';
export const renderValue = (value) => {
    if (isUrl(value)) {
        return (React.createElement("a", { href: value, target: '_blank', className: cx('external-link'), rel: "noreferrer" }, value));
    }
    return value;
};
//# sourceMappingURL=uiUtils.js.map