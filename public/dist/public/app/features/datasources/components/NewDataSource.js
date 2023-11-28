import React from 'react';
import { PluginType } from '@grafana/data';
import { LinkButton, FilterInput } from '@grafana/ui';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { PluginsErrorsInfo } from 'app/features/plugins/components/PluginsErrorsInfo';
import { useDispatch, useSelector } from 'app/types';
import { DataSourceCategories } from '../components/DataSourceCategories';
import { DataSourceTypeCardList } from '../components/DataSourceTypeCardList';
import { useAddDatasource, useLoadDataSourcePlugins, getFilteredDataSourcePlugins, setDataSourceTypeSearchQuery, useDataSourcesRoutes, } from '../state';
export function NewDataSource() {
    useLoadDataSourcePlugins();
    const dispatch = useDispatch();
    const filteredDataSources = useSelector((s) => getFilteredDataSourcePlugins(s.dataSources));
    const searchQuery = useSelector((s) => s.dataSources.dataSourceTypeSearchQuery);
    const isLoadingDatasourcePlugins = useSelector((s) => s.dataSources.isLoadingDataSourcePlugins);
    const dataSourceCategories = useSelector((s) => s.dataSources.categories);
    const onAddDataSource = useAddDatasource();
    const onSetSearchQuery = (q) => dispatch(setDataSourceTypeSearchQuery(q));
    return (React.createElement(NewDataSourceView, { dataSources: filteredDataSources, dataSourceCategories: dataSourceCategories, searchQuery: searchQuery, isLoading: isLoadingDatasourcePlugins, onAddDataSource: onAddDataSource, onSetSearchQuery: onSetSearchQuery }));
}
export function NewDataSourceView({ dataSources, dataSourceCategories, searchQuery, isLoading, onAddDataSource, onSetSearchQuery, }) {
    const dataSourcesRoutes = useDataSourcesRoutes();
    if (isLoading) {
        return React.createElement(PageLoader, null);
    }
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "page-action-bar" },
            React.createElement(FilterInput, { value: searchQuery, onChange: onSetSearchQuery, placeholder: "Filter by name or type" }),
            React.createElement("div", { className: "page-action-bar__spacer" }),
            React.createElement(LinkButton, { href: dataSourcesRoutes.List, fill: "outline", variant: "secondary", icon: "arrow-left" }, "Cancel")),
        !searchQuery && React.createElement(PluginsErrorsInfo, { filterByPluginType: PluginType.datasource }),
        React.createElement("div", null,
            searchQuery && (React.createElement(DataSourceTypeCardList, { dataSourcePlugins: dataSources, onClickDataSourceType: onAddDataSource })),
            !searchQuery && (React.createElement(DataSourceCategories, { categories: dataSourceCategories, onClickDataSourceType: onAddDataSource })))));
}
//# sourceMappingURL=NewDataSource.js.map