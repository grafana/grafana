import * as tslib_1 from "tslib";
// Libraries
import React, { Component } from 'react';
// Components
import PageLoader from '../PageLoader/PageLoader';
var PageContents = /** @class */ (function (_super) {
    tslib_1.__extends(PageContents, _super);
    function PageContents() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    PageContents.prototype.render = function () {
        var isLoading = this.props.isLoading;
        return (React.createElement("div", { className: "page-container page-body" },
            isLoading && React.createElement(PageLoader, null),
            this.props.children));
    };
    return PageContents;
}(Component));
export default PageContents;
//# sourceMappingURL=PageContents.js.map