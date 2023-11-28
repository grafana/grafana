import React from 'react';
import { LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { Trans } from 'app/core/internationalization';
import { ROUTES as CONNECTIONS_ROUTES } from 'app/features/connections/constants';
import { AccessControlAction } from 'app/types';
export function AddNewDataSourceButton({ variant, onClick }) {
    const hasCreateRights = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
    const newDataSourceURL = CONNECTIONS_ROUTES.DataSourcesNew;
    return (React.createElement(LinkButton, { variant: variant || 'primary', href: newDataSourceURL, disabled: !hasCreateRights, tooltip: !hasCreateRights ? 'You do not have permission to configure new data sources' : undefined, onClick: onClick, target: "_blank" },
        React.createElement(Trans, { i18nKey: "data-source-picker.add-new-data-source" }, "Configure a new data source")));
}
//# sourceMappingURL=AddNewDataSourceButton.js.map