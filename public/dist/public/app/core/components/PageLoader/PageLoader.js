import React from 'react';
import { LoadingPlaceholder } from '@grafana/ui';
const PageLoader = ({ pageName = '' }) => {
    const loadingText = `Loading ${pageName}...`;
    return (React.createElement("div", { className: "page-loader-wrapper" },
        React.createElement(LoadingPlaceholder, { text: loadingText })));
};
export default PageLoader;
//# sourceMappingURL=PageLoader.js.map