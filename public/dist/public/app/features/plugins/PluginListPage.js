import { __awaiter, __generator } from "tslib";
import React from 'react';
import { connect } from 'react-redux';
import Page from 'app/core/components/Page/Page';
import PageActionBar from 'app/core/components/PageActionBar/PageActionBar';
import PluginList from './PluginList';
import { loadPlugins } from './state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { getPlugins, getPluginsSearchQuery } from './state/selectors';
import { setPluginsSearchQuery } from './state/reducers';
import { useAsync } from 'react-use';
import { selectors } from '@grafana/e2e-selectors';
import { PluginsErrorsInfo } from './PluginsErrorsInfo';
var mapStateToProps = function (state) { return ({
    navModel: getNavModel(state.navIndex, 'plugins'),
    plugins: getPlugins(state.plugins),
    searchQuery: getPluginsSearchQuery(state.plugins),
    hasFetched: state.plugins.hasFetched,
}); };
var mapDispatchToProps = {
    loadPlugins: loadPlugins,
    setPluginsSearchQuery: setPluginsSearchQuery,
};
var connector = connect(mapStateToProps, mapDispatchToProps);
export var PluginListPage = function (_a) {
    var hasFetched = _a.hasFetched, navModel = _a.navModel, plugins = _a.plugins, setPluginsSearchQuery = _a.setPluginsSearchQuery, searchQuery = _a.searchQuery, loadPlugins = _a.loadPlugins;
    useAsync(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            loadPlugins();
            return [2 /*return*/];
        });
    }); }, [loadPlugins]);
    var actionTarget = '_blank';
    var linkButton = {
        href: 'https://grafana.com/plugins?utm_source=grafana_plugin_list',
        title: 'Find more plugins on Grafana.com',
    };
    return (React.createElement(Page, { navModel: navModel, "aria-label": selectors.pages.PluginsList.page },
        React.createElement(Page.Contents, { isLoading: !hasFetched },
            React.createElement(React.Fragment, null,
                React.createElement(PageActionBar, { searchQuery: searchQuery, setSearchQuery: function (query) { return setPluginsSearchQuery(query); }, linkButton: linkButton, placeholder: "Search by name, author, description or type", target: actionTarget }),
                React.createElement(PluginsErrorsInfo, null),
                hasFetched && plugins && React.createElement(PluginList, { plugins: plugins })))));
};
export default connect(mapStateToProps, mapDispatchToProps)(PluginListPage);
//# sourceMappingURL=PluginListPage.js.map