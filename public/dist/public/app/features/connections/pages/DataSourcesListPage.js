import * as React from 'react';
import { Page } from 'app/core/components/Page/Page';
import { DataSourceAddButton } from 'app/features/datasources/components/DataSourceAddButton';
import { DataSourcesList } from 'app/features/datasources/components/DataSourcesList';
import { getDataSourcesCount } from 'app/features/datasources/state';
import { useSelector } from 'app/types';
export function DataSourcesListPage() {
    const dataSourcesCount = useSelector(({ dataSources }) => getDataSourcesCount(dataSources));
    const actions = dataSourcesCount > 0 ? React.createElement(DataSourceAddButton, null) : undefined;
    return (React.createElement(Page, { navId: 'connections-datasources', actions: actions },
        React.createElement(Page.Contents, null,
            React.createElement(DataSourcesList, null))));
}
//# sourceMappingURL=DataSourcesListPage.js.map