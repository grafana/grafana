import React from 'react';
import { config } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { Trans } from 'app/core/internationalization';
import { AccessControlAction } from 'app/types';
import { useDataSourcesRoutes } from '../state';
export function DataSourceAddButton() {
    const canCreateDataSource = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
    const dataSourcesRoutes = useDataSourcesRoutes();
    return canCreateDataSource ? (React.createElement(LinkButton, { icon: "plus", href: config.appSubUrl + dataSourcesRoutes.New },
        React.createElement(Trans, { i18nKey: "data-sources.datasource-add-button.label" }, "Add new data source"))) : null;
}
//# sourceMappingURL=DataSourceAddButton.js.map