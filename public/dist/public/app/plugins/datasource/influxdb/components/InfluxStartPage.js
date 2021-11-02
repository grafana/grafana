import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import InfluxCheatSheet from './InfluxCheatSheet';
var InfluxStartPage = /** @class */ (function (_super) {
    __extends(InfluxStartPage, _super);
    function InfluxStartPage() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    InfluxStartPage.prototype.render = function () {
        return React.createElement(InfluxCheatSheet, { onClickExample: this.props.onClickExample });
    };
    return InfluxStartPage;
}(PureComponent));
export default InfluxStartPage;
//# sourceMappingURL=InfluxStartPage.js.map