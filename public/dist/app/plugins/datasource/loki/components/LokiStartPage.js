import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import LokiCheatSheet from './LokiCheatSheet';
var LokiStartPage = /** @class */ (function (_super) {
    tslib_1.__extends(LokiStartPage, _super);
    function LokiStartPage() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    LokiStartPage.prototype.render = function () {
        return (React.createElement("div", { className: "grafana-info-box grafana-info-box--max-lg" },
            React.createElement(LokiCheatSheet, { onClickExample: this.props.onClickExample })));
    };
    return LokiStartPage;
}(PureComponent));
export default LokiStartPage;
//# sourceMappingURL=LokiStartPage.js.map