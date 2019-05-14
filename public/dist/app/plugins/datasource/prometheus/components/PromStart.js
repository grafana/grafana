import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import PromCheatSheet from './PromCheatSheet';
var PromStart = /** @class */ (function (_super) {
    tslib_1.__extends(PromStart, _super);
    function PromStart() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    PromStart.prototype.render = function () {
        return (React.createElement("div", { className: "grafana-info-box grafana-info-box--max-lg" },
            React.createElement(PromCheatSheet, { onClickExample: this.props.onClickExample })));
    };
    return PromStart;
}(PureComponent));
export default PromStart;
//# sourceMappingURL=PromStart.js.map