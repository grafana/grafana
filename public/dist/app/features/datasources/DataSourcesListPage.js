import * as tslib_1 from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
// Components
import Page from 'app/core/components/Page/Page';
import OrgActionBar from 'app/core/components/OrgActionBar/OrgActionBar';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import DataSourcesList from './DataSourcesList';
// Actions
import { loadDataSources, setDataSourcesLayoutMode, setDataSourcesSearchQuery } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getDataSources, getDataSourcesCount, getDataSourcesLayoutMode, getDataSourcesSearchQuery, } from './state/selectors';
var emptyListModel = {
    title: 'There are no data sources defined yet',
    buttonIcon: 'gicon gicon-add-datasources',
    buttonLink: 'datasources/new',
    buttonTitle: 'Add data source',
    proTip: 'You can also define data sources through configuration files.',
    proTipLink: 'http://docs.grafana.org/administration/provisioning/#datasources?utm_source=grafana_ds_list',
    proTipLinkTitle: 'Learn more',
    proTipTarget: '_blank',
};
var DataSourcesListPage = /** @class */ (function (_super) {
    tslib_1.__extends(DataSourcesListPage, _super);
    function DataSourcesListPage() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    DataSourcesListPage.prototype.componentDidMount = function () {
        this.fetchDataSources();
    };
    DataSourcesListPage.prototype.fetchDataSources = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.props.loadDataSources()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    DataSourcesListPage.prototype.render = function () {
        var _a = this.props, dataSources = _a.dataSources, dataSourcesCount = _a.dataSourcesCount, navModel = _a.navModel, layoutMode = _a.layoutMode, searchQuery = _a.searchQuery, setDataSourcesSearchQuery = _a.setDataSourcesSearchQuery, setDataSourcesLayoutMode = _a.setDataSourcesLayoutMode, hasFetched = _a.hasFetched;
        var linkButton = {
            href: 'datasources/new',
            title: 'Add data source',
        };
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, { isLoading: !hasFetched },
                React.createElement(React.Fragment, null,
                    hasFetched && dataSourcesCount === 0 && React.createElement(EmptyListCTA, { model: emptyListModel }),
                    hasFetched &&
                        dataSourcesCount > 0 && [
                        React.createElement(OrgActionBar, { layoutMode: layoutMode, searchQuery: searchQuery, onSetLayoutMode: function (mode) { return setDataSourcesLayoutMode(mode); }, setSearchQuery: function (query) { return setDataSourcesSearchQuery(query); }, linkButton: linkButton, key: "action-bar" }),
                        React.createElement(DataSourcesList, { dataSources: dataSources, layoutMode: layoutMode, key: "list" }),
                    ]))));
    };
    return DataSourcesListPage;
}(PureComponent));
export { DataSourcesListPage };
function mapStateToProps(state) {
    return {
        navModel: getNavModel(state.navIndex, 'datasources'),
        dataSources: getDataSources(state.dataSources),
        layoutMode: getDataSourcesLayoutMode(state.dataSources),
        dataSourcesCount: getDataSourcesCount(state.dataSources),
        searchQuery: getDataSourcesSearchQuery(state.dataSources),
        hasFetched: state.dataSources.hasFetched,
    };
}
var mapDispatchToProps = {
    loadDataSources: loadDataSources,
    setDataSourcesSearchQuery: setDataSourcesSearchQuery,
    setDataSourcesLayoutMode: setDataSourcesLayoutMode,
};
export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(DataSourcesListPage));
//# sourceMappingURL=DataSourcesListPage.js.map