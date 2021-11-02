import { __assign, __extends } from "tslib";
import React from 'react';
import { AbstractList } from './AbstractList';
var List = /** @class */ (function (_super) {
    __extends(List, _super);
    function List() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    List.prototype.render = function () {
        return React.createElement(AbstractList, __assign({}, this.props));
    };
    return List;
}(React.PureComponent));
export { List };
//# sourceMappingURL=List.js.map