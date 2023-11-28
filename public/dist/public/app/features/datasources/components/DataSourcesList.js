import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { config } from '@grafana/runtime';
import { LinkButton, Card, Tag, useStyles2 } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { contextSrv } from 'app/core/core';
import { AccessControlAction, useSelector } from 'app/types';
import { getDataSources, getDataSourcesCount, useDataSourcesRoutes, useLoadDataSources } from '../state';
import { trackCreateDashboardClicked, trackExploreClicked, trackDataSourcesListViewed } from '../tracking';
import { constructDataSourceExploreUrl } from '../utils';
import { DataSourcesListHeader } from './DataSourcesListHeader';
export function DataSourcesList() {
    const { isLoading } = useLoadDataSources();
    const dataSources = useSelector((state) => getDataSources(state.dataSources));
    const dataSourcesCount = useSelector(({ dataSources }) => getDataSourcesCount(dataSources));
    const hasCreateRights = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
    const hasWriteRights = contextSrv.hasPermission(AccessControlAction.DataSourcesWrite);
    const hasExploreRights = contextSrv.hasPermission(AccessControlAction.DataSourcesExplore);
    return (React.createElement(DataSourcesListView, { dataSources: dataSources, dataSourcesCount: dataSourcesCount, isLoading: isLoading, hasCreateRights: hasCreateRights, hasWriteRights: hasWriteRights, hasExploreRights: hasExploreRights }));
}
export function DataSourcesListView({ dataSources, dataSourcesCount, isLoading, hasCreateRights, hasWriteRights, hasExploreRights, }) {
    const styles = useStyles2(getStyles);
    const dataSourcesRoutes = useDataSourcesRoutes();
    const location = useLocation();
    useEffect(() => {
        trackDataSourcesListViewed({
            grafana_version: config.buildInfo.version,
            path: location.pathname,
        });
    }, [location]);
    if (isLoading) {
        return React.createElement(PageLoader, null);
    }
    if (dataSourcesCount === 0) {
        return (React.createElement(EmptyListCTA, { buttonDisabled: !hasCreateRights, title: "No data sources defined", buttonIcon: "database", buttonLink: dataSourcesRoutes.New, buttonTitle: "Add data source", proTip: "You can also define data sources through configuration files.", proTipLink: "http://docs.grafana.org/administration/provisioning/?utm_source=grafana_ds_list#data-sources", proTipLinkTitle: "Learn more", proTipTarget: "_blank" }));
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(DataSourcesListHeader, null),
        React.createElement("ul", { className: styles.list }, dataSources.map((dataSource) => {
            const dsLink = config.appSubUrl + dataSourcesRoutes.Edit.replace(/:uid/gi, dataSource.uid);
            return (React.createElement("li", { key: dataSource.uid },
                React.createElement(Card, { href: hasWriteRights ? dsLink : undefined },
                    React.createElement(Card.Heading, null, dataSource.name),
                    React.createElement(Card.Figure, null,
                        React.createElement("img", { src: dataSource.typeLogoUrl, alt: "", height: "40px", width: "40px", className: styles.logo })),
                    React.createElement(Card.Meta, null, [
                        dataSource.typeName,
                        dataSource.url,
                        dataSource.isDefault && React.createElement(Tag, { key: "default-tag", name: 'default', colorIndex: 1 }),
                    ]),
                    React.createElement(Card.Tags, null,
                        React.createElement(LinkButton, { icon: "apps", fill: "outline", variant: "secondary", href: `dashboard/new-with-ds/${dataSource.uid}`, onClick: () => {
                                trackCreateDashboardClicked({
                                    grafana_version: config.buildInfo.version,
                                    datasource_uid: dataSource.uid,
                                    plugin_name: dataSource.typeName,
                                    path: location.pathname,
                                });
                            } }, "Build a dashboard"),
                        hasExploreRights && (React.createElement(LinkButton, { icon: "compass", fill: "outline", variant: "secondary", className: styles.button, href: constructDataSourceExploreUrl(dataSource), onClick: () => {
                                trackExploreClicked({
                                    grafana_version: config.buildInfo.version,
                                    datasource_uid: dataSource.uid,
                                    plugin_name: dataSource.typeName,
                                    path: location.pathname,
                                });
                            } }, "Explore"))))));
        }))));
}
const getStyles = (theme) => {
    return {
        list: css({
            listStyle: 'none',
            display: 'grid',
            // gap: '8px', Add back when legacy support for old Card interface is dropped
        }),
        logo: css({
            objectFit: 'contain',
        }),
        button: css({
            marginLeft: theme.spacing(2),
        }),
    };
};
//# sourceMappingURL=DataSourcesList.js.map