import { __assign, __extends } from "tslib";
// Libraries
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
// Services & Utils
import { contextSrv } from 'app/core/core';
// Components
import Page from 'app/core/components/Page/Page';
import PageActionBar from 'app/core/components/PageActionBar/PageActionBar';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import DataSourcesList from './DataSourcesList';
import { AccessControlAction } from 'app/types';
// Actions
import { loadDataSources } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getDataSources, getDataSourcesCount, getDataSourcesLayoutMode, getDataSourcesSearchQuery, } from './state/selectors';
import { setDataSourcesLayoutMode, setDataSourcesSearchQuery } from './state/reducers';
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
var connector = connect(mapStateToProps, mapDispatchToProps);
var emptyListModel = {
    title: 'No data sources defined',
    buttonIcon: 'database',
    buttonLink: 'datasources/new',
    buttonTitle: 'Add data source',
    proTip: 'You can also define data sources through configuration files.',
    proTipLink: 'http://docs.grafana.org/administration/provisioning/#datasources?utm_source=grafana_ds_list',
    proTipLinkTitle: 'Learn more',
    proTipTarget: '_blank',
};
var DataSourcesListPage = /** @class */ (function (_super) {
    __extends(DataSourcesListPage, _super);
    function DataSourcesListPage() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    DataSourcesListPage.prototype.componentDidMount = function () {
        this.props.loadDataSources();
    };
    DataSourcesListPage.prototype.render = function () {
        var _a = this.props, dataSources = _a.dataSources, dataSourcesCount = _a.dataSourcesCount, navModel = _a.navModel, layoutMode = _a.layoutMode, searchQuery = _a.searchQuery, setDataSourcesSearchQuery = _a.setDataSourcesSearchQuery, hasFetched = _a.hasFetched;
        var canCreateDataSource = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate) &&
            contextSrv.hasPermission(AccessControlAction.DataSourcesWrite);
        var linkButton = {
            href: 'datasources/new',
            title: 'Add data source',
            disabled: !canCreateDataSource,
        };
        var emptyList = __assign(__assign({}, emptyListModel), { buttonDisabled: !canCreateDataSource });
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, { isLoading: !hasFetched },
                React.createElement(React.Fragment, null,
                    hasFetched && dataSourcesCount === 0 && React.createElement(EmptyListCTA, __assign({}, emptyList)),
                    hasFetched &&
                        dataSourcesCount > 0 && [
                        React.createElement(PageActionBar, { searchQuery: searchQuery, setSearchQuery: function (query) { return setDataSourcesSearchQuery(query); }, linkButton: linkButton, key: "action-bar" }),
                        React.createElement(DataSourcesList, { dataSources: dataSources, layoutMode: layoutMode, key: "list" }),
                    ]))));
    };
    return DataSourcesListPage;
}(PureComponent));
export { DataSourcesListPage };
export default connector(DataSourcesListPage);
//# sourceMappingURL=DataSourcesListPage.js.map