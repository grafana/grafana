import { __awaiter } from "tslib";
import config from 'app/core/config';
import { listFolders } from 'app/features/browse-dashboards/api/services';
import { getGrafanaSearcher } from './searcher';
import { queryResultToViewItem } from './utils';
export function getFolderChildren(parentUid, parentTitle, dashboardsAtRoot = false) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!config.featureToggles.nestedFolders) {
            console.error('getFolderChildren requires nestedFolders feature toggle');
            return [];
        }
        if (!dashboardsAtRoot && !parentUid) {
            // We don't show dashboards at root in folder view yet - they're shown under a dummy 'general'
            // folder that FolderView adds in
            const folders = yield listFolders();
            return folders;
        }
        const searcher = getGrafanaSearcher();
        const dashboardsResults = yield searcher.search({
            kind: ['dashboard'],
            query: '*',
            location: parentUid || 'general',
            limit: 1000,
        });
        const dashboardItems = dashboardsResults.view.map((item) => {
            return queryResultToViewItem(item, dashboardsResults.view);
        });
        const folders = yield listFolders(parentUid, parentTitle);
        return [...folders, ...dashboardItems];
    });
}
//# sourceMappingURL=folders.js.map