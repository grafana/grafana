import React from 'react';
import { LoadingPlaceholder } from '@grafana/ui';
import { Page } from './Page';
export var Loader = function (_a) {
    var _b = _a.text, text = _b === void 0 ? 'Loading...' : _b;
    return (React.createElement(Page, null,
        React.createElement("div", { className: "page-loader-wrapper" },
            React.createElement(LoadingPlaceholder, { text: text }))));
};
//# sourceMappingURL=Loader.js.map