import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
var DataSourcesListItem = /** @class */ (function (_super) {
    tslib_1.__extends(DataSourcesListItem, _super);
    function DataSourcesListItem() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    DataSourcesListItem.prototype.render = function () {
        var dataSource = this.props.dataSource;
        return (React.createElement("li", { className: "card-item-wrapper" },
            React.createElement("a", { className: "card-item", href: "datasources/edit/" + dataSource.id },
                React.createElement("div", { className: "card-item-header" },
                    React.createElement("div", { className: "card-item-type" }, dataSource.type)),
                React.createElement("div", { className: "card-item-body" },
                    React.createElement("figure", { className: "card-item-figure" },
                        React.createElement("img", { src: dataSource.typeLogoUrl, alt: dataSource.name })),
                    React.createElement("div", { className: "card-item-details" },
                        React.createElement("div", { className: "card-item-name" },
                            dataSource.name,
                            dataSource.isDefault && React.createElement("span", { className: "btn btn-secondary btn-mini card-item-label" }, "default")),
                        React.createElement("div", { className: "card-item-sub-name" }, dataSource.url))))));
    };
    return DataSourcesListItem;
}(PureComponent));
export { DataSourcesListItem };
export default DataSourcesListItem;
//# sourceMappingURL=DataSourcesListItem.js.map