import * as React from 'react';
import { Page } from 'app/core/components/Page/Page';
import { NewDataSource } from 'app/features/datasources/components/NewDataSource';
export function NewDataSourcePage() {
    return (React.createElement(Page, { navId: 'connections-datasources', pageNav: { text: 'Add data source', subTitle: 'Choose a data source type', active: true } },
        React.createElement(Page.Contents, null,
            React.createElement(NewDataSource, null))));
}
//# sourceMappingURL=NewDataSourcePage.js.map