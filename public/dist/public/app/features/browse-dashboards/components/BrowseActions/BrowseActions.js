import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, Tooltip, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { t, Trans } from 'app/core/internationalization';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { useDispatch } from 'app/types';
import { ShowModalReactEvent } from 'app/types/events';
import { useDeleteItemsMutation, useMoveItemsMutation } from '../../api/browseDashboardsAPI';
import { setAllSelection, useActionSelectionState } from '../../state';
import { DeleteModal } from './DeleteModal';
import { MoveModal } from './MoveModal';
export function BrowseActions() {
    const styles = useStyles2(getStyles);
    const dispatch = useDispatch();
    const selectedItems = useActionSelectionState();
    const [deleteItems] = useDeleteItemsMutation();
    const [moveItems] = useMoveItemsMutation();
    const [, stateManager] = useSearchStateManager();
    // Folders can only be moved if nested folders is enabled
    const moveIsInvalid = useMemo(() => !config.featureToggles.nestedFolders && Object.values(selectedItems.folder).some((v) => v), [selectedItems]);
    const isSearching = stateManager.hasSearchFilters();
    const onActionComplete = () => {
        dispatch(setAllSelection({ isSelected: false, folderUID: undefined }));
        if (isSearching) {
            // Redo search query
            stateManager.doSearchWithDebounce();
        }
    };
    const onDelete = () => __awaiter(this, void 0, void 0, function* () {
        yield deleteItems({ selectedItems });
        trackAction('delete', selectedItems);
        onActionComplete();
    });
    const onMove = (destinationUID) => __awaiter(this, void 0, void 0, function* () {
        yield moveItems({ selectedItems, destinationUID });
        trackAction('move', selectedItems);
        onActionComplete();
    });
    const showMoveModal = () => {
        appEvents.publish(new ShowModalReactEvent({
            component: MoveModal,
            props: {
                selectedItems,
                onConfirm: onMove,
            },
        }));
    };
    const showDeleteModal = () => {
        appEvents.publish(new ShowModalReactEvent({
            component: DeleteModal,
            props: {
                selectedItems,
                onConfirm: onDelete,
            },
        }));
    };
    const moveButton = (React.createElement(Button, { onClick: showMoveModal, variant: "secondary", disabled: moveIsInvalid },
        React.createElement(Trans, { i18nKey: "browse-dashboards.action.move-button" }, "Move")));
    return (React.createElement("div", { className: styles.row, "data-testid": "manage-actions" },
        moveIsInvalid ? (React.createElement(Tooltip, { content: t('browse-dashboards.action.cannot-move-folders', 'Folders cannot be moved') }, moveButton)) : (moveButton),
        React.createElement(Button, { onClick: showDeleteModal, variant: "destructive" },
            React.createElement(Trans, { i18nKey: "browse-dashboards.action.delete-button" }, "Delete"))));
}
const getStyles = (theme) => ({
    row: css({
        display: 'flex',
        flexDirection: 'row',
        gap: theme.spacing(1),
        marginBottom: theme.spacing(2),
    }),
});
const actionMap = {
    move: 'grafana_manage_dashboards_item_moved',
    delete: 'grafana_manage_dashboards_item_deleted',
};
function trackAction(action, selectedItems) {
    const selectedDashboards = Object.keys(selectedItems.dashboard).filter((uid) => selectedItems.dashboard[uid]);
    const selectedFolders = Object.keys(selectedItems.folder).filter((uid) => selectedItems.folder[uid]);
    reportInteraction(actionMap[action], {
        item_counts: {
            folder: selectedFolders.length,
            dashboard: selectedDashboards.length,
        },
        source: 'tree_actions',
    });
}
//# sourceMappingURL=BrowseActions.js.map