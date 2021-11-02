// Libraries
import React from 'react';
import { cx } from '@emotion/css';
// Components
import PageLoader from '../PageLoader/PageLoader';
export var PageContents = function (_a) {
    var isLoading = _a.isLoading, children = _a.children, className = _a.className;
    return React.createElement("div", { className: cx('page-container', 'page-body', className) }, isLoading ? React.createElement(PageLoader, null) : children);
};
//# sourceMappingURL=PageContents.js.map