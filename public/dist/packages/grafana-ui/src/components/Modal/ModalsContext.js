import { __assign, __extends } from "tslib";
import React from 'react';
var ModalsContext = React.createContext({
    component: null,
    props: {},
    showModal: function () { },
    hideModal: function () { },
});
var ModalsProvider = /** @class */ (function (_super) {
    __extends(ModalsProvider, _super);
    function ModalsProvider(props) {
        var _this = _super.call(this, props) || this;
        _this.showModal = function (component, props) {
            _this.setState({
                component: component,
                props: props,
            });
        };
        _this.hideModal = function () {
            _this.setState({
                component: null,
                props: {},
            });
        };
        _this.state = {
            component: props.component || null,
            props: props.props || {},
            showModal: _this.showModal,
            hideModal: _this.hideModal,
        };
        return _this;
    }
    ModalsProvider.prototype.render = function () {
        return React.createElement(ModalsContext.Provider, { value: this.state }, this.props.children);
    };
    return ModalsProvider;
}(React.Component));
export { ModalsProvider };
export var ModalRoot = function () { return (React.createElement(ModalsContext.Consumer, null, function (_a) {
    var Component = _a.component, props = _a.props;
    return Component ? React.createElement(Component, __assign({}, props)) : null;
})); };
export var ModalsController = ModalsContext.Consumer;
//# sourceMappingURL=ModalsContext.js.map