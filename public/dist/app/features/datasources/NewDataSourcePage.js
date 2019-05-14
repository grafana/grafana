import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import Page from 'app/core/components/Page/Page';
import { addDataSource, loadDataSourceTypes, setDataSourceTypeSearchQuery } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getDataSourceTypes } from './state/selectors';
import { FilterInput } from 'app/core/components/FilterInput/FilterInput';
var NewDataSourcePage = /** @class */ (function (_super) {
    tslib_1.__extends(NewDataSourcePage, _super);
    function NewDataSourcePage() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onDataSourceTypeClicked = function (plugin) {
            _this.props.addDataSource(plugin);
        };
        _this.onSearchQueryChange = function (value) {
            _this.props.setDataSourceTypeSearchQuery(value);
        };
        return _this;
    }
    NewDataSourcePage.prototype.componentDidMount = function () {
        this.props.loadDataSourceTypes();
    };
    NewDataSourcePage.prototype.render = function () {
        var _this = this;
        var _a = this.props, navModel = _a.navModel, dataSourceTypes = _a.dataSourceTypes, dataSourceTypeSearchQuery = _a.dataSourceTypeSearchQuery, isLoading = _a.isLoading;
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, { isLoading: isLoading },
                React.createElement("h2", { className: "add-data-source-header" }, "Choose data source type"),
                React.createElement("div", { className: "add-data-source-search" },
                    React.createElement(FilterInput, { labelClassName: "gf-form--has-input-icon", inputClassName: "gf-form-input width-20", value: dataSourceTypeSearchQuery, onChange: this.onSearchQueryChange, placeholder: "Filter by name or type" })),
                React.createElement("div", { className: "add-data-source-grid" }, dataSourceTypes.map(function (plugin, index) {
                    return (React.createElement("div", { onClick: function () { return _this.onDataSourceTypeClicked(plugin); }, className: "add-data-source-grid-item", key: plugin.id + "-" + index },
                        React.createElement("img", { className: "add-data-source-grid-item-logo", src: plugin.info.logos.small }),
                        React.createElement("span", { className: "add-data-source-grid-item-text" }, plugin.name)));
                })))));
    };
    return NewDataSourcePage;
}(PureComponent));
function mapStateToProps(state) {
    return {
        navModel: getNavModel(state.navIndex, 'datasources'),
        dataSourceTypes: getDataSourceTypes(state.dataSources),
        dataSourceTypeSearchQuery: state.dataSources.dataSourceTypeSearchQuery,
        isLoading: state.dataSources.isLoadingDataSources,
    };
}
var mapDispatchToProps = {
    addDataSource: addDataSource,
    loadDataSourceTypes: loadDataSourceTypes,
    setDataSourceTypeSearchQuery: setDataSourceTypeSearchQuery,
};
export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(NewDataSourcePage));
//# sourceMappingURL=NewDataSourcePage.js.map