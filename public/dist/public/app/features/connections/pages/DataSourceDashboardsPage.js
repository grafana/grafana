import * as React from 'react';
import { useParams } from 'react-router-dom';
import { Page } from 'app/core/components/Page/Page';
import { DataSourceDashboards } from 'app/features/datasources/components/DataSourceDashboards';
import { useDataSourceSettingsNav } from '../hooks/useDataSourceSettingsNav';
export function DataSourceDashboardsPage() {
    const { uid } = useParams();
    const { navId, pageNav } = useDataSourceSettingsNav('dashboards');
    return (React.createElement(Page, { navId: navId, pageNav: pageNav },
        React.createElement(Page.Contents, null,
            React.createElement(DataSourceDashboards, { uid: uid }))));
}
//# sourceMappingURL=DataSourceDashboardsPage.js.map