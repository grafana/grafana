import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
var Panel = /** @class */ (function (_super) {
    tslib_1.__extends(Panel, _super);
    function Panel() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onClickToggle = function () { return _this.props.onToggle(!_this.props.isOpen); };
        return _this;
    }
    Panel.prototype.render = function () {
        var _a = this.props, isOpen = _a.isOpen, loading = _a.loading;
        var iconClass = isOpen ? 'fa fa-caret-up' : 'fa fa-caret-down';
        var loaderClass = loading ? 'explore-panel__loader explore-panel__loader--active' : 'explore-panel__loader';
        return (React.createElement("div", { className: "explore-panel panel-container" },
            React.createElement("div", { className: "explore-panel__header", onClick: this.onClickToggle },
                React.createElement("div", { className: "explore-panel__header-buttons" },
                    React.createElement("span", { className: iconClass })),
                React.createElement("div", { className: "explore-panel__header-label" }, this.props.label)),
            isOpen && (React.createElement("div", { className: "explore-panel__body" },
                React.createElement("div", { className: loaderClass }),
                this.props.children))));
    };
    return Panel;
}(PureComponent));
export default Panel;
//# sourceMappingURL=Panel.js.map