import React, { useCallback } from 'react';
import { CallToActionCard } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { useDispatch } from 'app/types';
import { PAGE_SIZE } from '../api/services';
import { useFlatTreeState, useCheckboxSelectionState, setFolderOpenState, setItemSelectionState, useChildrenByParentUIDState, setAllSelection, useBrowseLoadingStatus, useLoadNextChildrenPage, fetchNextChildrenPage, } from '../state';
import { SelectionState } from '../types';
import { DashboardsTree } from './DashboardsTree';
export function BrowseView({ folderUID, width, height, canSelect }) {
    const status = useBrowseLoadingStatus(folderUID);
    const dispatch = useDispatch();
    const flatTree = useFlatTreeState(folderUID);
    const selectedItems = useCheckboxSelectionState();
    const childrenByParentUID = useChildrenByParentUIDState();
    const handleFolderClick = useCallback((clickedFolderUID, isOpen) => {
        dispatch(setFolderOpenState({ folderUID: clickedFolderUID, isOpen }));
        if (isOpen) {
            dispatch(fetchNextChildrenPage({ parentUID: clickedFolderUID, pageSize: PAGE_SIZE }));
        }
    }, [dispatch]);
    const handleItemSelectionChange = useCallback((item, isSelected) => {
        dispatch(setItemSelectionState({ item, isSelected }));
    }, [dispatch]);
    const isSelected = useCallback((item) => {
        if (item === '$all') {
            // We keep the boolean $all state up to date in redux, so we can short-circut
            // the logic if we know this has been selected
            if (selectedItems.$all) {
                return SelectionState.Selected;
            }
            // Otherwise, if we have any selected items, then it should be in 'mixed' state
            for (const selection of Object.values(selectedItems)) {
                if (typeof selection === 'boolean') {
                    continue;
                }
                for (const uid in selection) {
                    const isSelected = selection[uid];
                    if (isSelected) {
                        return SelectionState.Mixed;
                    }
                }
            }
            // Otherwise otherwise, nothing is selected and header should be unselected
            return SelectionState.Unselected;
        }
        const isSelected = selectedItems[item.kind][item.uid];
        if (isSelected) {
            return SelectionState.Selected;
        }
        // Because if _all_ children, then the parent is selected (and bailed in the previous check),
        // this .some check will only return true if the children are partially selected
        const isMixed = hasSelectedDescendants(item, childrenByParentUID, selectedItems);
        if (isMixed) {
            return SelectionState.Mixed;
        }
        return SelectionState.Unselected;
    }, [selectedItems, childrenByParentUID]);
    const isItemLoaded = useCallback((itemIndex) => {
        const treeItem = flatTree[itemIndex];
        if (!treeItem) {
            return false;
        }
        const item = treeItem.item;
        const result = !(item.kind === 'ui' && item.uiKind === 'pagination-placeholder');
        return result;
    }, [flatTree]);
    const handleLoadMore = useLoadNextChildrenPage();
    if (status === 'fulfilled' && flatTree.length === 0) {
        return (React.createElement("div", { style: { width } }, canSelect ? (React.createElement(EmptyListCTA, { title: folderUID ? "This folder doesn't have any dashboards yet" : 'No dashboards yet. Create your first!', buttonIcon: "plus", buttonTitle: "Create Dashboard", buttonLink: folderUID ? `dashboard/new?folderUid=${folderUID}` : 'dashboard/new', proTip: folderUID && 'Add/move dashboards to your folder at ->', proTipLink: folderUID && 'dashboards', proTipLinkTitle: folderUID && 'Browse dashboards', proTipTarget: "" })) : (React.createElement(CallToActionCard, { callToActionElement: React.createElement("span", null, "This folder is empty") }))));
    }
    return (React.createElement(DashboardsTree, { canSelect: canSelect, items: flatTree, width: width, height: height, isSelected: isSelected, onFolderClick: handleFolderClick, onAllSelectionChange: (newState) => dispatch(setAllSelection({ isSelected: newState, folderUID })), onItemSelectionChange: handleItemSelectionChange, isItemLoaded: isItemLoaded, requestLoadMore: handleLoadMore }));
}
function hasSelectedDescendants(item, childrenByParentUID, selectedItems) {
    const collection = childrenByParentUID[item.uid];
    if (!collection) {
        return false;
    }
    return collection.items.some((v) => {
        const thisIsSelected = selectedItems[v.kind][v.uid];
        if (thisIsSelected) {
            return thisIsSelected;
        }
        return hasSelectedDescendants(v, childrenByParentUID, selectedItems);
    });
}
//# sourceMappingURL=BrowseView.js.map