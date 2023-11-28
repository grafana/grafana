// Libraries
import React from 'react';
import PageLoader from '../PageLoader/PageLoader';
export const PageContents = ({ isLoading, children, className }) => {
    let content = className ? React.createElement("div", { className: className }, children) : children;
    return React.createElement(React.Fragment, null, isLoading ? React.createElement(PageLoader, null) : content);
};
//# sourceMappingURL=PageContents.js.map