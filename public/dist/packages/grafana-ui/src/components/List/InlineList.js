import { __assign, __extends } from "tslib";
import React from 'react';
import { AbstractList } from './AbstractList';
var InlineList = /** @class */ (function (_super) {
    __extends(InlineList, _super);
    function InlineList() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    InlineList.prototype.render = function () {
        return React.createElement(AbstractList, __assign({ inline: true }, this.props));
    };
    return InlineList;
}(React.PureComponent));
export { InlineList };
//# sourceMappingURL=InlineList.js.map