import * as tslib_1 from "tslib";
import React from 'react';
import tags from 'app/core/utils/tags';
var TagBadge = /** @class */ (function (_super) {
    tslib_1.__extends(TagBadge, _super);
    function TagBadge(props) {
        return _super.call(this, props) || this;
    }
    TagBadge.prototype.render = function () {
        var _a = this.props, label = _a.label, removeIcon = _a.removeIcon, count = _a.count;
        var _b = tags.getTagColorsFromName(label), color = _b.color, borderColor = _b.borderColor;
        var tagStyle = {
            backgroundColor: color,
            borderColor: borderColor,
        };
        var countLabel = count !== 0 && React.createElement("span", { className: "tag-count-label" }, "(" + count + ")");
        return (React.createElement("span", { className: "label label-tag", style: tagStyle },
            removeIcon && React.createElement("i", { className: "fa fa-remove" }),
            label,
            " ",
            countLabel));
    };
    return TagBadge;
}(React.Component));
export { TagBadge };
//# sourceMappingURL=TagBadge.js.map