import React from 'react';
var PageLoader = function (_a) {
    var _b = _a.pageName, pageName = _b === void 0 ? '' : _b;
    var loadingText = "Loading " + pageName + "...";
    return (React.createElement("div", { className: "page-loader-wrapper" },
        React.createElement("i", { className: "page-loader-wrapper__spinner fa fa-spinner fa-spin" }),
        React.createElement("div", { className: "page-loader-wrapper__text" }, loadingText)));
};
export default PageLoader;
//# sourceMappingURL=PageLoader.js.map