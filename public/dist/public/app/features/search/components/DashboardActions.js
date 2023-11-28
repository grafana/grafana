import React, { useMemo, useState } from 'react';
import { config, reportInteraction } from '@grafana/runtime';
import { Menu, Dropdown, Button, Icon, HorizontalGroup } from '@grafana/ui';
import { MoveToFolderModal } from '../page/components/MoveToFolderModal';
import { getImportPhrase, getNewDashboardPhrase, getNewFolderPhrase, getNewPhrase } from '../tempI18nPhrases';
export const DashboardActions = ({ folder, canCreateFolders = false, canCreateDashboards = false }) => {
    var _a;
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const canMove = config.featureToggles.nestedFolders && ((_a = folder === null || folder === void 0 ? void 0 : folder.canSave) !== null && _a !== void 0 ? _a : false);
    const moveSelection = useMemo(() => new Map([['folder', new Set((folder === null || folder === void 0 ? void 0 : folder.uid) ? [folder.uid] : [])]]), [folder]);
    const actionUrl = (type) => {
        let url = `dashboard/${type}`;
        const isTypeNewFolder = type === 'new_folder';
        if (isTypeNewFolder) {
            url = `dashboards/folder/new/`;
        }
        if (folder === null || folder === void 0 ? void 0 : folder.uid) {
            url += `?folderUid=${folder.uid}`;
        }
        return url;
    };
    const MenuActions = () => {
        return (React.createElement(Menu, null,
            canCreateDashboards && (React.createElement(Menu.Item, { url: actionUrl('new'), label: getNewDashboardPhrase(), onClick: () => reportInteraction('grafana_menu_item_clicked', { url: actionUrl('new'), from: '/dashboards' }) })),
            canCreateFolders && (config.featureToggles.nestedFolders || !(folder === null || folder === void 0 ? void 0 : folder.uid)) && (React.createElement(Menu.Item, { url: actionUrl('new_folder'), label: getNewFolderPhrase(), onClick: () => reportInteraction('grafana_menu_item_clicked', { url: actionUrl('new_folder'), from: '/dashboards' }) })),
            canCreateDashboards && (React.createElement(Menu.Item, { url: actionUrl('import'), label: getImportPhrase(), onClick: () => reportInteraction('grafana_menu_item_clicked', { url: actionUrl('import'), from: '/dashboards' }) }))));
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("div", null,
            React.createElement(HorizontalGroup, null,
                canMove && (React.createElement(Button, { onClick: () => setIsMoveModalOpen(true), icon: "exchange-alt", variant: "secondary" }, "Move")),
                React.createElement(Dropdown, { overlay: MenuActions, placement: "bottom-start" },
                    React.createElement(Button, { variant: "primary" },
                        getNewPhrase(),
                        React.createElement(Icon, { name: "angle-down" }))))),
        canMove && isMoveModalOpen && (React.createElement(MoveToFolderModal, { onMoveItems: () => { }, results: moveSelection, onDismiss: () => setIsMoveModalOpen(false) }))));
};
//# sourceMappingURL=DashboardActions.js.map