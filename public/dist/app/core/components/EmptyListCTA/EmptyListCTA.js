import * as tslib_1 from "tslib";
import React, { Component } from 'react';
var EmptyListCTA = /** @class */ (function (_super) {
    tslib_1.__extends(EmptyListCTA, _super);
    function EmptyListCTA() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    EmptyListCTA.prototype.render = function () {
        var _a = this.props.model, title = _a.title, buttonIcon = _a.buttonIcon, buttonLink = _a.buttonLink, buttonTitle = _a.buttonTitle, onClick = _a.onClick, proTip = _a.proTip, proTipLink = _a.proTipLink, proTipLinkTitle = _a.proTipLinkTitle, proTipTarget = _a.proTipTarget;
        return (React.createElement("div", { className: "empty-list-cta" },
            React.createElement("div", { className: "empty-list-cta__title" }, title),
            React.createElement("a", { onClick: onClick, href: buttonLink, className: "empty-list-cta__button btn btn-xlarge btn-primary" },
                React.createElement("i", { className: buttonIcon }),
                buttonTitle),
            proTip && (React.createElement("div", { className: "empty-list-cta__pro-tip" },
                React.createElement("i", { className: "fa fa-rocket" }),
                " ProTip: ",
                proTip,
                React.createElement("a", { className: "text-link empty-list-cta__pro-tip-link", href: proTipLink, target: proTipTarget }, proTipLinkTitle)))));
    };
    return EmptyListCTA;
}(Component));
export default EmptyListCTA;
//# sourceMappingURL=EmptyListCTA.js.map