import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { LogLabel } from './LogLabel';
var LogLabels = /** @class */ (function (_super) {
    tslib_1.__extends(LogLabels, _super);
    function LogLabels() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    LogLabels.prototype.render = function () {
        var _a = this.props, getRows = _a.getRows, labels = _a.labels, onClickLabel = _a.onClickLabel, plain = _a.plain;
        return (React.createElement("span", { className: "logs-labels" }, Object.keys(labels).map(function (key) { return (React.createElement(LogLabel, { key: key, getRows: getRows, label: key, value: labels[key], plain: plain, onClickLabel: onClickLabel })); })));
    };
    return LogLabels;
}(PureComponent));
export { LogLabels };
//# sourceMappingURL=LogLabels.js.map