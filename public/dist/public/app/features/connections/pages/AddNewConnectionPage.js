import * as React from 'react';
import { Page } from 'app/core/components/Page/Page';
import { AddNewConnection } from '../tabs/ConnectData';
export function AddNewConnectionPage() {
    return (React.createElement(Page, { navId: 'connections-add-new-connection' },
        React.createElement(Page.Contents, null,
            React.createElement(AddNewConnection, null))));
}
//# sourceMappingURL=AddNewConnectionPage.js.map