import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
// Components
import QueryRow from './QueryRow';
var QueryRows = /** @class */ (function (_super) {
    tslib_1.__extends(QueryRows, _super);
    function QueryRows() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    QueryRows.prototype.render = function () {
        var _a = this.props, _b = _a.className, className = _b === void 0 ? '' : _b, exploreEvents = _a.exploreEvents, exploreId = _a.exploreId, queryKeys = _a.queryKeys;
        return (React.createElement("div", { className: className }, queryKeys.map(function (key, index) {
            return React.createElement(QueryRow, { key: key, exploreEvents: exploreEvents, exploreId: exploreId, index: index });
        })));
    };
    return QueryRows;
}(PureComponent));
export default QueryRows;
//# sourceMappingURL=QueryRows.js.map