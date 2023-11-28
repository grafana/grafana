import { __awaiter } from "tslib";
import { config, getBackendSrv } from '@grafana/runtime';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { getGrafanaSearcher } from 'app/features/search/service';
import { queryResultToViewItem } from 'app/features/search/service/utils';
export const PAGE_SIZE = 50;
export function listFolders(parentUID, parentTitle, // TODO: remove this when old UI is gone
page = 1, pageSize = PAGE_SIZE) {
    return __awaiter(this, void 0, void 0, function* () {
        if (parentUID && !config.featureToggles.nestedFolders) {
            return [];
        }
        const backendSrv = getBackendSrv();
        const folders = yield backendSrv.get('/api/folders', {
            parentUid: parentUID,
            page,
            limit: pageSize,
        });
        return folders.map((item) => ({
            kind: 'folder',
            uid: item.uid,
            title: item.title,
            parentTitle,
            parentUID,
            url: `/dashboards/f/${item.uid}/`,
        }));
    });
}
export function listDashboards(parentUID, page = 1, pageSize = PAGE_SIZE) {
    return __awaiter(this, void 0, void 0, function* () {
        const searcher = getGrafanaSearcher();
        const dashboardsResults = yield searcher.search({
            kind: ['dashboard'],
            query: '*',
            location: parentUID || 'general',
            from: (page - 1) * pageSize,
            limit: pageSize,
        });
        return dashboardsResults.view.map((item) => {
            const viewItem = queryResultToViewItem(item, dashboardsResults.view);
            // TODO: Once we remove nestedFolders feature flag, undo this and prevent the 'general'
            // parentUID from being set in searcher
            if (viewItem.parentUID === GENERAL_FOLDER_UID) {
                viewItem.parentUID = undefined;
            }
            return viewItem;
        });
    });
}
//# sourceMappingURL=services.js.map