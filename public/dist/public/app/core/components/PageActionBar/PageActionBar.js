import { __assign, __extends } from "tslib";
import React, { PureComponent } from 'react';
import { LinkButton, FilterInput } from '@grafana/ui';
var PageActionBar = /** @class */ (function (_super) {
    __extends(PageActionBar, _super);
    function PageActionBar() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    PageActionBar.prototype.render = function () {
        var _a = this.props, searchQuery = _a.searchQuery, linkButton = _a.linkButton, setSearchQuery = _a.setSearchQuery, target = _a.target, _b = _a.placeholder, placeholder = _b === void 0 ? 'Search by name or type' : _b;
        var linkProps = { href: linkButton === null || linkButton === void 0 ? void 0 : linkButton.href, disabled: linkButton === null || linkButton === void 0 ? void 0 : linkButton.disabled };
        if (target) {
            linkProps.target = target;
        }
        return (React.createElement("div", { className: "page-action-bar" },
            React.createElement("div", { className: "gf-form gf-form--grow" },
                React.createElement(FilterInput, { value: searchQuery, onChange: setSearchQuery, placeholder: placeholder })),
            linkButton && React.createElement(LinkButton, __assign({}, linkProps), linkButton.title)));
    };
    return PageActionBar;
}(PureComponent));
export default PageActionBar;
//# sourceMappingURL=PageActionBar.js.map