import React from 'react';
import { LinkButton } from '@grafana/ui';
import { ROUTES } from '../../connections/constants';
import { DataSourceTypeCardList } from './DataSourceTypeCardList';
export function DataSourceCategories({ categories, onClickDataSourceType }) {
    const moreDataSourcesLink = `${ROUTES.AddNewConnection}?cat=data-source`;
    return (React.createElement(React.Fragment, null,
        categories.map(({ id, title, plugins }) => (React.createElement("div", { className: "add-data-source-category", key: id },
            React.createElement("div", { className: "add-data-source-category__header", id: id }, title),
            React.createElement(DataSourceTypeCardList, { dataSourcePlugins: plugins, onClickDataSourceType: onClickDataSourceType })))),
        React.createElement("div", { className: "add-data-source-more" },
            React.createElement(LinkButton, { variant: "secondary", href: moreDataSourcesLink, target: "_self", rel: "noopener" }, "Find more data source plugins"))));
}
//# sourceMappingURL=DataSourceCategories.js.map