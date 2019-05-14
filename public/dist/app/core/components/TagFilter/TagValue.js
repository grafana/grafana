import * as tslib_1 from "tslib";
import React from 'react';
import { TagBadge } from './TagBadge';
var TagValue = /** @class */ (function (_super) {
    tslib_1.__extends(TagValue, _super);
    function TagValue(props) {
        var _this = _super.call(this, props) || this;
        _this.onClick = _this.onClick.bind(_this);
        return _this;
    }
    TagValue.prototype.onClick = function (event) {
        this.props.onRemove(this.props.value, event);
    };
    TagValue.prototype.render = function () {
        var value = this.props.value;
        return React.createElement(TagBadge, { label: value.label, removeIcon: false, count: 0, onClick: this.onClick });
    };
    return TagValue;
}(React.Component));
export { TagValue };
//# sourceMappingURL=TagValue.js.map