import { css } from '@emotion/css';
import React from 'react';
import { useLocation } from 'react-router-dom';
import { locationSearchToObject } from '@grafana/runtime';
import { LoadingPlaceholder, Select, RadioButtonGroup, useStyles2, Tooltip, Field } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { ROUTES as CONNECTIONS_ROUTES } from 'app/features/connections/constants';
import { useSelector } from 'app/types';
import { HorizontalGroup } from '../components/HorizontalGroup';
import { PluginList } from '../components/PluginList';
import { SearchField } from '../components/SearchField';
import { Sorters } from '../helpers';
import { useHistory } from '../hooks/useHistory';
import { useGetAll, useIsRemotePluginsAvailable, useDisplayMode } from '../state/hooks';
import { PluginListDisplayMode } from '../types';
export default function Browse({ route }) {
    var _a, _b;
    const location = useLocation();
    const locationSearch = locationSearchToObject(location.search);
    const navModel = useSelector((state) => getNavModel(state.navIndex, 'plugins'));
    const { displayMode, setDisplayMode } = useDisplayMode();
    const styles = useStyles2(getStyles);
    const history = useHistory();
    const remotePluginsAvailable = useIsRemotePluginsAvailable();
    const keyword = ((_a = locationSearch.q) === null || _a === void 0 ? void 0 : _a.toString()) || '';
    const filterBy = ((_b = locationSearch.filterBy) === null || _b === void 0 ? void 0 : _b.toString()) || 'installed';
    const filterByType = locationSearch.filterByType || 'all';
    const sortBy = locationSearch.sortBy || Sorters.nameAsc;
    const { isLoading, error, plugins } = useGetAll({
        keyword,
        type: filterByType !== 'all' ? filterByType : undefined,
        isInstalled: filterBy === 'installed' ? true : undefined,
        isCore: filterBy === 'installed' ? undefined : false, // We only would like to show core plugins when the user filters to installed plugins
    }, sortBy);
    const filterByOptions = [
        { value: 'all', label: 'All' },
        { value: 'installed', label: 'Installed' },
    ];
    const onSortByChange = (value) => {
        history.push({ query: { sortBy: value.value } });
    };
    const onFilterByChange = (value) => {
        history.push({ query: { filterBy: value } });
    };
    const onFilterByTypeChange = (value) => {
        history.push({ query: { filterByType: value.value } });
    };
    const onSearch = (q) => {
        history.push({ query: { filterBy, filterByType, q } });
    };
    // How should we handle errors?
    if (error) {
        console.error(error.message);
        return null;
    }
    const subTitle = (React.createElement("div", null,
        "Extend the Grafana experience with panel plugins and apps. To find more data sources go to",
        ' ',
        React.createElement("a", { className: "external-link", href: `${CONNECTIONS_ROUTES.AddNewConnection}?cat=data-source` }, "Connections"),
        "."));
    return (React.createElement(Page, { navModel: navModel, subTitle: subTitle },
        React.createElement(Page.Contents, null,
            React.createElement(HorizontalGroup, { wrap: true },
                React.createElement(Field, { label: "Search" },
                    React.createElement(SearchField, { value: keyword, onSearch: onSearch })),
                React.createElement(HorizontalGroup, { wrap: true, className: styles.actionBar },
                    React.createElement(Field, { label: "Type" },
                        React.createElement(Select, { "aria-label": "Plugin type filter", value: filterByType, onChange: onFilterByTypeChange, width: 18, options: [
                                { value: 'all', label: 'All' },
                                { value: 'datasource', label: 'Data sources' },
                                { value: 'panel', label: 'Panels' },
                                { value: 'app', label: 'Applications' },
                            ] })),
                    remotePluginsAvailable ? (React.createElement(Field, { label: "State" },
                        React.createElement(RadioButtonGroup, { value: filterBy, onChange: onFilterByChange, options: filterByOptions }))) : (React.createElement(Tooltip, { content: "This filter has been disabled because the Grafana server cannot access grafana.com", placement: "top" },
                        React.createElement("div", null,
                            React.createElement(Field, { label: "State" },
                                React.createElement(RadioButtonGroup, { disabled: true, value: filterBy, onChange: onFilterByChange, options: filterByOptions }))))),
                    React.createElement(Field, { label: "Sort" },
                        React.createElement(Select, { "aria-label": "Sort Plugins List", width: 24, value: sortBy, onChange: onSortByChange, options: [
                                { value: 'nameAsc', label: 'By name (A-Z)' },
                                { value: 'nameDesc', label: 'By name (Z-A)' },
                                { value: 'updated', label: 'By updated date' },
                                { value: 'published', label: 'By published date' },
                                { value: 'downloads', label: 'By downloads' },
                            ] })),
                    React.createElement(Field, { label: "View" },
                        React.createElement(RadioButtonGroup, { className: styles.displayAs, value: displayMode, onChange: setDisplayMode, options: [
                                {
                                    value: PluginListDisplayMode.Grid,
                                    icon: 'table',
                                    description: 'Display plugins in a grid layout',
                                },
                                { value: PluginListDisplayMode.List, icon: 'list-ul', description: 'Display plugins in list' },
                            ] })))),
            React.createElement("div", { className: styles.listWrap }, isLoading ? (React.createElement(LoadingPlaceholder, { className: css `
                margin-bottom: 0;
              `, text: "Loading results" })) : (React.createElement(PluginList, { plugins: plugins, displayMode: displayMode }))))));
}
const getStyles = (theme) => ({
    actionBar: css `
    ${theme.breakpoints.up('xl')} {
      margin-left: auto;
    }
  `,
    listWrap: css `
    margin-top: ${theme.spacing(2)};
  `,
    displayAs: css `
    svg {
      margin-right: 0;
    }
  `,
});
//# sourceMappingURL=Browse.js.map