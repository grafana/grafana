import { __awaiter } from "tslib";
import React, { useMemo, useState } from 'react';
import { Page } from 'app/core/components/Page/Page';
import { FolderActionsButton } from '../browse-dashboards/components/FolderActionsButton';
import { buildNavModel, getLibraryPanelsTabID } from '../folders/state/navModel';
import { LibraryPanelsSearch } from '../library-panels/components/LibraryPanelsSearch/LibraryPanelsSearch';
import { OpenLibraryPanelModal } from '../library-panels/components/OpenLibraryPanelModal/OpenLibraryPanelModal';
import { useGetFolderQuery, useSaveFolderMutation } from './api/browseDashboardsAPI';
export function BrowseFolderLibraryPanelsPage({ match }) {
    const { uid: folderUID } = match.params;
    const { data: folderDTO } = useGetFolderQuery(folderUID);
    const [selected, setSelected] = useState(undefined);
    const [saveFolder] = useSaveFolderMutation();
    const navModel = useMemo(() => {
        var _a;
        if (!folderDTO) {
            return undefined;
        }
        const model = buildNavModel(folderDTO);
        // Set the "Library panels" tab to active
        const libraryPanelsTabID = getLibraryPanelsTabID(folderDTO.uid);
        const libraryPanelsTab = (_a = model.children) === null || _a === void 0 ? void 0 : _a.find((child) => child.id === libraryPanelsTabID);
        if (libraryPanelsTab) {
            libraryPanelsTab.active = true;
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
            React.createElement(LibraryPanelsSearch, { onClick: setSelected, currentFolderUID: folderUID, showSecondaryActions: true, showSort: true, showPanelFilter: true }),
            selected ? React.createElement(OpenLibraryPanelModal, { onDismiss: () => setSelected(undefined), libraryPanel: selected }) : null)));
}
export default BrowseFolderLibraryPanelsPage;
//# sourceMappingURL=BrowseFolderLibraryPanelsPage.js.map