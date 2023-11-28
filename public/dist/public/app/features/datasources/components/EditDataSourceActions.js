import React from 'react';
import { config } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
import { useDataSource } from '../state';
import { trackCreateDashboardClicked, trackDsConfigClicked, trackExploreClicked } from '../tracking';
import { constructDataSourceExploreUrl } from '../utils';
export function EditDataSourceActions({ uid }) {
    const dataSource = useDataSource(uid);
    const hasExploreRights = contextSrv.hasPermission(AccessControlAction.DataSourcesExplore);
    return (React.createElement(React.Fragment, null,
        hasExploreRights && (React.createElement(LinkButton, { variant: "secondary", size: "sm", href: constructDataSourceExploreUrl(dataSource), onClick: () => {
                trackDsConfigClicked('explore');
                trackExploreClicked({
                    grafana_version: config.buildInfo.version,
                    datasource_uid: dataSource.uid,
                    plugin_name: dataSource.typeName,
                    path: location.pathname,
                });
            } }, "Explore data")),
        React.createElement(LinkButton, { size: "sm", variant: "secondary", href: `dashboard/new-with-ds/${dataSource.uid}`, onClick: () => {
                trackDsConfigClicked('build_a_dashboard');
                trackCreateDashboardClicked({
                    grafana_version: config.buildInfo.version,
                    datasource_uid: dataSource.uid,
                    plugin_name: dataSource.typeName,
                    path: location.pathname,
                });
            } }, "Build a dashboard")));
}
//# sourceMappingURL=EditDataSourceActions.js.map