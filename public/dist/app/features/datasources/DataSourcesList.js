import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import classNames from 'classnames';
// Components
import DataSourcesListItem from './DataSourcesListItem';
import { LayoutModes } from '../../core/components/LayoutSelector/LayoutSelector';
var DataSourcesList = /** @class */ (function (_super) {
    tslib_1.__extends(DataSourcesList, _super);
    function DataSourcesList() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    DataSourcesList.prototype.render = function () {
        var _a = this.props, dataSources = _a.dataSources, layoutMode = _a.layoutMode;
        var listStyle = classNames({
            'card-section': true,
            'card-list-layout-grid': layoutMode === LayoutModes.Grid,
            'card-list-layout-list': layoutMode === LayoutModes.List,
        });
        return (React.createElement("section", { className: listStyle },
            React.createElement("ol", { className: "card-list" }, dataSources.map(function (dataSource, index) {
                return React.createElement(DataSourcesListItem, { dataSource: dataSource, key: dataSource.id + "-" + index });
            }))));
    };
    return DataSourcesList;
}(PureComponent));
export { DataSourcesList };
export default DataSourcesList;
//# sourceMappingURL=DataSourcesList.js.map