import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';
import { Button, VerticalGroup } from '@grafana/ui';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { changeToLibraryPanel } from 'app/features/panel/state/actions';
import { useDispatch } from 'app/types';
import { PanelTypeFilter } from '../../../../core/components/PanelTypeFilter/PanelTypeFilter';
import { AddLibraryPanelModal } from '../AddLibraryPanelModal/AddLibraryPanelModal';
import { ChangeLibraryPanelModal } from '../ChangeLibraryPanelModal/ChangeLibraryPanelModal';
import { LibraryPanelsView } from '../LibraryPanelsView/LibraryPanelsView';
export const PanelLibraryOptionsGroup = ({ panel, searchQuery, isWidget = false }) => {
    var _a;
    const [showingAddPanelModal, setShowingAddPanelModal] = useState(false);
    const [changeToPanel, setChangeToPanel] = useState(undefined);
    const [panelFilter, setPanelFilter] = useState([]);
    const onPanelFilterChange = useCallback((plugins) => {
        setPanelFilter(plugins.map((p) => p.id));
    }, [setPanelFilter]);
    const dashboard = getDashboardSrv().getCurrent();
    const dispatch = useDispatch();
    const useLibraryPanel = () => __awaiter(void 0, void 0, void 0, function* () {
        if (!changeToPanel) {
            return;
        }
        setChangeToPanel(undefined);
        dispatch(changeToLibraryPanel(panel, changeToPanel));
    });
    const onAddToPanelLibrary = () => setShowingAddPanelModal(true);
    const onDismissChangeToPanel = () => setChangeToPanel(undefined);
    return (React.createElement(VerticalGroup, { spacing: "md" },
        !panel.libraryPanel && (React.createElement(VerticalGroup, { align: "center" },
            React.createElement(Button, { icon: "plus", onClick: onAddToPanelLibrary, variant: "secondary", fullWidth: true }, "Create new library panel"))),
        React.createElement(PanelTypeFilter, { onChange: onPanelFilterChange, isWidget: isWidget }),
        React.createElement("div", { className: styles.libraryPanelsView },
            React.createElement(LibraryPanelsView, { currentPanelId: (_a = panel.libraryPanel) === null || _a === void 0 ? void 0 : _a.uid, searchString: searchQuery, panelFilter: panelFilter, onClickCard: setChangeToPanel, showSecondaryActions: true, isWidget: isWidget })),
        showingAddPanelModal && (React.createElement(AddLibraryPanelModal, { panel: panel, onDismiss: () => setShowingAddPanelModal(false), initialFolderUid: dashboard === null || dashboard === void 0 ? void 0 : dashboard.meta.folderUid, isOpen: showingAddPanelModal })),
        changeToPanel && (React.createElement(ChangeLibraryPanelModal, { panel: panel, onDismiss: onDismissChangeToPanel, onConfirm: useLibraryPanel }))));
};
const styles = {
    libraryPanelsView: css `
    width: 100%;
  `,
};
//# sourceMappingURL=PanelLibraryOptionsGroup.js.map