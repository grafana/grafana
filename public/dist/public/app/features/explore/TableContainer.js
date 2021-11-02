import { __extends, __values } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { Collapse, Table } from '@grafana/ui';
import { splitOpen } from './state/main';
import { config } from 'app/core/config';
import { PANEL_BORDER } from 'app/core/constants';
import { MetaInfoText } from './MetaInfoText';
import { getFieldLinksForExplore } from './utils/links';
function mapStateToProps(state, _a) {
    var exploreId = _a.exploreId;
    var explore = state.explore;
    // @ts-ignore
    var item = explore[exploreId];
    var loadingInState = item.loading, tableResult = item.tableResult, range = item.range;
    var loading = tableResult && tableResult.length > 0 ? false : loadingInState;
    return { loading: loading, tableResult: tableResult, range: range };
}
var mapDispatchToProps = {
    splitOpen: splitOpen,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
var TableContainer = /** @class */ (function (_super) {
    __extends(TableContainer, _super);
    function TableContainer() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    TableContainer.prototype.getTableHeight = function () {
        var tableResult = this.props.tableResult;
        if (!tableResult || tableResult.length === 0) {
            return 200;
        }
        // tries to estimate table height
        return Math.max(Math.min(600, tableResult.length * 35) + 35);
    };
    TableContainer.prototype.render = function () {
        var e_1, _a;
        var _b = this.props, loading = _b.loading, onCellFilterAdded = _b.onCellFilterAdded, tableResult = _b.tableResult, width = _b.width, splitOpen = _b.splitOpen, range = _b.range, ariaLabel = _b.ariaLabel;
        var height = this.getTableHeight();
        var tableWidth = width - config.theme.panelPadding * 2 - PANEL_BORDER;
        var hasTableResult = tableResult === null || tableResult === void 0 ? void 0 : tableResult.length;
        if (tableResult && tableResult.length) {
            var _loop_1 = function (field) {
                field.getLinks = function (config) {
                    return getFieldLinksForExplore({ field: field, rowIndex: config.valueRowIndex, splitOpenFn: splitOpen, range: range });
                };
            };
            try {
                // Bit of code smell here. We need to add links here to the frame modifying the frame on every render.
                // Should work fine in essence but still not the ideal way to pass props. In logs container we do this
                // differently and sidestep this getLinks API on a dataframe
                for (var _c = __values(tableResult.fields), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var field = _d.value;
                    _loop_1(field);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        return (React.createElement(Collapse, { label: "Table", loading: loading, isOpen: true }, hasTableResult ? (React.createElement(Table, { ariaLabel: ariaLabel, data: tableResult, width: tableWidth, height: height, onCellFilterAdded: onCellFilterAdded })) : (React.createElement(MetaInfoText, { metaItems: [{ value: '0 series returned' }] }))));
    };
    return TableContainer;
}(PureComponent));
export { TableContainer };
export default connector(TableContainer);
//# sourceMappingURL=TableContainer.js.map