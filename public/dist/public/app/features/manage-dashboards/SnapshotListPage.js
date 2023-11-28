import React from 'react';
import { Page } from 'app/core/components/Page/Page';
import { SnapshotListTable } from './components/SnapshotListTable';
export const SnapshotListPage = ({}) => {
    return (React.createElement(Page, { navId: "dashboards/snapshots" },
        React.createElement(Page.Contents, null,
            React.createElement(SnapshotListTable, null))));
};
export default SnapshotListPage;
//# sourceMappingURL=SnapshotListPage.js.map