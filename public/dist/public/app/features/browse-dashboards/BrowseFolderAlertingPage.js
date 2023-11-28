import { __awaiter } from "tslib";
import React, { useMemo } from 'react';
import { Page } from 'app/core/components/Page/Page';
import { buildNavModel, getAlertingTabID } from 'app/features/folders/state/navModel';
import { useSelector } from 'app/types';
import { AlertsFolderView } from '../alerting/unified/AlertsFolderView';
import { useGetFolderQuery, useSaveFolderMutation } from './api/browseDashboardsAPI';
import { FolderActionsButton } from './components/FolderActionsButton';
export function BrowseFolderAlertingPage({ match }) {
    const { uid: folderUID } = match.params;
    const { data: folderDTO } = useGetFolderQuery(folderUID);
    const folder = useSelector((state) => state.folder);
    const [saveFolder] = useSaveFolderMutation();
    const navModel = useMemo(() => {
        var _a;
        if (!folderDTO) {
            return undefined;
        }
        const model = buildNavModel(folderDTO);
        // Set the "Alerting" tab to active
        const alertingTabID = getAlertingTabID(folderDTO.uid);
        const alertingTab = (_a = model.children) === null || _a === void 0 ? void 0 : _a.find((child) => child.id === alertingTabID);
        if (alertingTab) {
            alertingTab.active = true;
        }
        return model;
    }, [folderDTO]);
    const onEditTitle = folderUID
        ? (newValue) => __awaiter(this, void 0, void 0, function* () {
            if (folderDTO) {
                const result = yield saveFolder(Object.assign(Object.assign({}, folderDTO), { title: newValue }));
                if ('error' in result) {
                    throw result.error;
                }
            }
        })
        : undefined;
    return (React.createElement(Page, { navId: "dashboards/browse", pageNav: navModel, onEditTitle: onEditTitle, actions: React.createElement(React.Fragment, null, folderDTO && React.createElement(FolderActionsButton, { folder: folderDTO })) },
        React.createElement(Page.Contents, null,
            React.createElement(AlertsFolderView, { folder: folder }))));
}
export default BrowseFolderAlertingPage;
//# sourceMappingURL=BrowseFolderAlertingPage.js.map