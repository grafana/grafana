import * as React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { config } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import DataSourceTabPage from 'app/features/datasources/components/DataSourceTabPage';
import { EditDataSource } from 'app/features/datasources/components/EditDataSource';
import { EditDataSourceActions } from 'app/features/datasources/components/EditDataSourceActions';
import { useDataSourceSettingsNav } from '../hooks/useDataSourceSettingsNav';
export function EditDataSourcePage() {
    const { uid } = useParams();
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const pageId = params.get('page');
    const dataSourcePageHeader = config.featureToggles.dataSourcePageHeader;
    const { navId, pageNav } = useDataSourceSettingsNav();
    if (dataSourcePageHeader) {
        return React.createElement(DataSourceTabPage, { uid: uid, pageId: pageId });
    }
    return (React.createElement(Page, { navId: navId, pageNav: pageNav, actions: React.createElement(EditDataSourceActions, { uid: uid }) },
        React.createElement(Page.Contents, null,
            React.createElement(EditDataSource, { uid: uid, pageId: pageId }))));
}
//# sourceMappingURL=EditDataSourcePage.js.map