import React from 'react';
import { LoadingPlaceholder } from '@grafana/ui';
export const Loader = ({ text = 'Loading...' }) => {
    return (React.createElement("div", { className: "page-loader-wrapper" },
        React.createElement(LoadingPlaceholder, { text: text })));
};
//# sourceMappingURL=Loader.js.map