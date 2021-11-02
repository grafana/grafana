import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import store from '../../store';
var LocalStorageValueProvider = /** @class */ (function (_super) {
    __extends(LocalStorageValueProvider, _super);
    function LocalStorageValueProvider(props) {
        var _this = _super.call(this, props) || this;
        _this.onSaveToStore = function (value) {
            var storageKey = _this.props.storageKey;
            try {
                store.setObject(storageKey, value);
            }
            catch (error) {
                console.error(error);
            }
            _this.setState({ value: value });
        };
        _this.onDeleteFromStore = function () {
            var _a = _this.props, storageKey = _a.storageKey, defaultValue = _a.defaultValue;
            try {
                store.delete(storageKey);
            }
            catch (error) {
                console.log(error);
            }
            _this.setState({ value: defaultValue });
        };
        var storageKey = props.storageKey, defaultValue = props.defaultValue;
        _this.state = {
            value: store.getObject(storageKey, defaultValue),
        };
        return _this;
    }
    LocalStorageValueProvider.prototype.render = function () {
        var children = this.props.children;
        var value = this.state.value;
        return React.createElement(React.Fragment, null, children(value, this.onSaveToStore, this.onDeleteFromStore));
    };
    return LocalStorageValueProvider;
}(PureComponent));
export { LocalStorageValueProvider };
//# sourceMappingURL=LocalStorageValueProvider.js.map