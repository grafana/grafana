import * as tslib_1 from "tslib";
// Libraries
import React, { Component } from 'react';
// Types
import { ThemeContext } from '@grafana/ui';
import Table from '@grafana/ui/src/components/Table/Table';
var TablePanel = /** @class */ (function (_super) {
    tslib_1.__extends(TablePanel, _super);
    function TablePanel(props) {
        return _super.call(this, props) || this;
    }
    TablePanel.prototype.render = function () {
        var _this = this;
        var _a = this.props, panelData = _a.panelData, options = _a.options;
        if (!panelData || !panelData.tableData) {
            return React.createElement("div", null, "No Table Data...");
        }
        return (React.createElement(ThemeContext.Consumer, null, function (theme) { return React.createElement(Table, tslib_1.__assign({}, _this.props, options, { theme: theme, data: panelData.tableData })); }));
    };
    return TablePanel;
}(Component));
export { TablePanel };
//# sourceMappingURL=TablePanel.js.map