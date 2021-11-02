import { __makeTemplateObject } from "tslib";
import React from 'react';
import { css } from '@emotion/css';
import { LoadingPlaceholder, Select, RadioButtonGroup, useStyles2, Tooltip } from '@grafana/ui';
import { useLocation } from 'react-router-dom';
import { locationSearchToObject } from '@grafana/runtime';
import { PluginList } from '../components/PluginList';
import { SearchField } from '../components/SearchField';
import { useHistory } from '../hooks/useHistory';
import { PluginAdminRoutes, PluginListDisplayMode } from '../types';
import { Page as PluginPage } from '../components/Page';
import { HorizontalGroup } from '../components/HorizontalGroup';
import { Page } from 'app/core/components/Page/Page';
import { useSelector } from 'react-redux';
import { getNavModel } from 'app/core/selectors/navModel';
import { useGetAllWithFilters, useIsRemotePluginsAvailable, useDisplayMode } from '../state/hooks';
import { Sorters } from '../helpers';
export default function Browse(_a) {
    var route = _a.route;
    var location = useLocation();
    var locationSearch = locationSearchToObject(location.search);
    var navModelId = getNavModelId(route.routeName);
    var navModel = useSelector(function (state) { return getNavModel(state.navIndex, navModelId); });
    var _b = useDisplayMode(), displayMode = _b.displayMode, setDisplayMode = _b.setDisplayMode;
    var styles = useStyles2(getStyles);
    var history = useHistory();
    var remotePluginsAvailable = useIsRemotePluginsAvailable();
    var query = locationSearch.q || '';
    var filterBy = locationSearch.filterBy || 'installed';
    var filterByType = locationSearch.filterByType || 'all';
    var sortBy = locationSearch.sortBy || Sorters.nameAsc;
    var _c = useGetAllWithFilters({
        query: query,
        filterBy: filterBy,
        filterByType: filterByType,
        sortBy: sortBy,
    }), isLoading = _c.isLoading, error = _c.error, plugins = _c.plugins;
    var filterByOptions = [
        { value: 'all', label: 'All' },
        { value: 'installed', label: 'Installed' },
    ];
    var onSortByChange = function (value) {
        history.push({ query: { sortBy: value.value } });
    };
    var onFilterByChange = function (value) {
        history.push({ query: { filterBy: value } });
    };
    var onFilterByTypeChange = function (value) {
        history.push({ query: { filterByType: value } });
    };
    var onSearch = function (q) {
        history.push({ query: { filterBy: 'all', filterByType: 'all', q: q } });
    };
    // How should we handle errors?
    if (error) {
        console.error(error.message);
        return null;
    }
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            React.createElement(PluginPage, null,
                React.createElement(HorizontalGroup, { wrap: true },
                    React.createElement(SearchField, { value: query, onSearch: onSearch }),
                    React.createElement(HorizontalGroup, { wrap: true, className: styles.actionBar },
                        React.createElement("div", null,
                            React.createElement(RadioButtonGroup, { value: filterByType, onChange: onFilterByTypeChange, options: [
                                    { value: 'all', label: 'All' },
                                    { value: 'datasource', label: 'Data sources' },
                                    { value: 'panel', label: 'Panels' },
                                    { value: 'app', label: 'Applications' },
                                ] })),
                        remotePluginsAvailable ? (React.createElement("div", null,
                            React.createElement(RadioButtonGroup, { value: filterBy, onChange: onFilterByChange, options: filterByOptions }))) : (React.createElement(Tooltip, { content: "This filter has been disabled because the Grafana server cannot access grafana.com", placement: "top" },
                            React.createElement("div", null,
                                React.createElement(RadioButtonGroup, { disabled: true, value: filterBy, onChange: onFilterByChange, options: filterByOptions })))),
                        React.createElement("div", null,
                            React.createElement(Select, { menuShouldPortal: true, "aria-label": "Sort Plugins List", width: 24, value: sortBy, onChange: onSortByChange, options: [
                                    { value: 'nameAsc', label: 'Sort by name (A-Z)' },
                                    { value: 'nameDesc', label: 'Sort by name (Z-A)' },
                                    { value: 'updated', label: 'Sort by updated date' },
                                    { value: 'published', label: 'Sort by published date' },
                                    { value: 'downloads', label: 'Sort by downloads' },
                                ] })),
                        React.createElement("div", null,
                            React.createElement(RadioButtonGroup, { className: styles.displayAs, value: displayMode, onChange: setDisplayMode, options: [
                                    {
                                        value: PluginListDisplayMode.Grid,
                                        icon: 'table',
                                        description: 'Display plugins in a grid layout',
                                    },
                                    { value: PluginListDisplayMode.List, icon: 'list-ul', description: 'Display plugins in list' },
                                ] })))),
                React.createElement("div", { className: styles.listWrap }, isLoading ? (React.createElement(LoadingPlaceholder, { className: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n                  margin-bottom: 0;\n                "], ["\n                  margin-bottom: 0;\n                "]))), text: "Loading results" })) : (React.createElement(PluginList, { plugins: plugins, displayMode: displayMode })))))));
}
var getStyles = function (theme) { return ({
    actionBar: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    ", " {\n      margin-left: auto;\n    }\n  "], ["\n    ", " {\n      margin-left: auto;\n    }\n  "])), theme.breakpoints.up('xl')),
    listWrap: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-top: ", ";\n  "], ["\n    margin-top: ", ";\n  "])), theme.spacing(2)),
    displayAs: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    svg {\n      margin-right: 0;\n    }\n  "], ["\n    svg {\n      margin-right: 0;\n    }\n  "]))),
}); };
// Because the component is used under multiple paths (/plugins and /admin/plugins) we need to get
// the correct navModel from the store
var getNavModelId = function (routeName) {
    if (routeName === PluginAdminRoutes.HomeAdmin || routeName === PluginAdminRoutes.BrowseAdmin) {
        return 'admin-plugins';
    }
    return 'plugins';
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=Browse.js.map