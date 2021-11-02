import { __extends } from "tslib";
import React from 'react';
import { getTagColorsFromName, Icon } from '@grafana/ui';
var TagBadge = /** @class */ (function (_super) {
    __extends(TagBadge, _super);
    function TagBadge(props) {
        return _super.call(this, props) || this;
    }
    TagBadge.prototype.render = function () {
        var _a = this.props, label = _a.label, removeIcon = _a.removeIcon, count = _a.count;
        var color = getTagColorsFromName(label).color;
        var tagStyle = {
            backgroundColor: color,
        };
        var countLabel = count !== 0 && React.createElement("span", { className: "tag-count-label" }, "(" + count + ")");
        return (React.createElement("span", { className: "label label-tag", style: tagStyle },
            removeIcon && React.createElement(Icon, { name: "times" }),
            label,
            " ",
            countLabel));
    };
    return TagBadge;
}(React.Component));
export { TagBadge };
//# sourceMappingURL=TagBadge.js.map