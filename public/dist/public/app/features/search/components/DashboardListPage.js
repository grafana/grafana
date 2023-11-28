import { css } from '@emotion/css';
import React, { memo } from 'react';
import { useAsync } from 'react-use';
import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import NewBrowseDashboardsPage from 'app/features/browse-dashboards/BrowseDashboardsPage';
import { newBrowseDashboardsEnabled } from 'app/features/browse-dashboards/featureFlag';
import { loadFolderPage } from '../loaders';
import ManageDashboardsNew from './ManageDashboardsNew';
export const DashboardListPageFeatureToggle = memo((props) => {
    if (newBrowseDashboardsEnabled()) {
        return React.createElement(NewBrowseDashboardsPage, Object.assign({}, props));
    }
    return React.createElement(DashboardListPage, Object.assign({}, props));
});
DashboardListPageFeatureToggle.displayName = 'DashboardListPageFeatureToggle';
const DashboardListPage = memo(({ match, location }) => {
    const { loading, value } = useAsync(() => {
        const uid = match.params.uid;
        const url = location.pathname;
        if (!uid || !url.startsWith('/dashboards')) {
            return Promise.resolve({});
        }
        return loadFolderPage(uid).then(({ folder, folderNav }) => {
            const path = locationUtil.stripBaseFromUrl(folder.url);
            if (path !== location.pathname) {
                locationService.replace(path);
            }
            return { folder, pageNav: folderNav };
        });
    }, [match.params.uid]);
    return (React.createElement(Page, { navId: "dashboards/browse", pageNav: value === null || value === void 0 ? void 0 : value.pageNav },
        React.createElement(Page.Contents, { isLoading: loading, className: css `
          display: flex;
          flex-direction: column;
          height: 100%;
        ` },
            React.createElement(ManageDashboardsNew, { folder: value === null || value === void 0 ? void 0 : value.folder }))));
});
DashboardListPage.displayName = 'DashboardListPage';
export default DashboardListPageFeatureToggle;
//# sourceMappingURL=DashboardListPage.js.map