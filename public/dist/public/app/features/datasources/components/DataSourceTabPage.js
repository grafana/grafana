import React from 'react';
import { Page } from 'app/core/components/Page/Page';
import { useDataSourceSettingsNav } from 'app/features/connections/hooks/useDataSourceSettingsNav';
import { EditDataSource } from '../components/EditDataSource';
import { EditDataSourceActions } from '../components/EditDataSourceActions';
import { useDataSourceInfo } from '../components/useDataSourceInfo';
import { DataSourceTitle } from './DataSourceTitle';
export function DataSourceTabPage({ uid, pageId }) {
    const { navId, pageNav, dataSourceHeader } = useDataSourceSettingsNav();
    const info = useDataSourceInfo({
        dataSourcePluginName: pageNav.dataSourcePluginName,
        alertingSupported: dataSourceHeader.alertingSupported,
    });
    return (React.createElement(Page, { navId: navId, pageNav: pageNav, renderTitle: (title) => React.createElement(DataSourceTitle, { title: title }), info: info, actions: React.createElement(EditDataSourceActions, { uid: uid }) },
        React.createElement(Page.Contents, null,
            React.createElement(EditDataSource, { uid: uid, pageId: pageId }))));
}
export default DataSourceTabPage;
//# sourceMappingURL=DataSourceTabPage.js.map