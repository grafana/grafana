import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useCallback, useId, useMemo, useState } from 'react';
import { usePopperTooltip } from 'react-popper-tooltip';
import { useAsync } from 'react-use';
import { Alert, Icon, Input, LoadingBar, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { skipToken, useGetFolderQuery } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { PAGE_SIZE } from 'app/features/browse-dashboards/api/services';
import { childrenByParentUIDSelector, createFlatTree, fetchNextChildrenPage, rootItemsSelector, useBrowseLoadingStatus, useLoadNextChildrenPage, } from 'app/features/browse-dashboards/state';
import { getPaginationPlaceholders } from 'app/features/browse-dashboards/state/utils';
import { getGrafanaSearcher } from 'app/features/search/service';
import { queryResultToViewItem } from 'app/features/search/service/utils';
import { useDispatch, useSelector } from 'app/types/store';
import { getDOMId, NestedFolderList } from './NestedFolderList';
import Trigger from './Trigger';
import { useTreeInteractions } from './hooks';
const EXCLUDED_KINDS = ['empty-folder', 'dashboard'];
export function NestedFolderPicker({ value, invalid, showRootFolder = true, excludeUIDs, onChange, }) {
    var _a, _b, _c;
    const styles = useStyles2(getStyles);
    const dispatch = useDispatch();
    const selectedFolder = useGetFolderQuery(value || skipToken);
    const rootStatus = useBrowseLoadingStatus(undefined);
    const [search, setSearch] = useState('');
    const [autoFocusButton, setAutoFocusButton] = useState(false);
    const [overlayOpen, setOverlayOpen] = useState(false);
    const [folderOpenState, setFolderOpenState] = useState({});
    const overlayId = useId();
    const [error] = useState(undefined); // TODO: error not populated anymore
    const searchState = useAsync(() => __awaiter(this, void 0, void 0, function* () {
        if (!search) {
            return undefined;
        }
        const searcher = getGrafanaSearcher();
        const queryResponse = yield searcher.search({
            query: search,
            kind: ['folder'],
            limit: 100,
        });
        const items = queryResponse.view.map((v) => queryResultToViewItem(v, queryResponse.view));
        return Object.assign(Object.assign({}, queryResponse), { items });
    }), [search]);
    const rootCollection = useSelector(rootItemsSelector);
    const childrenCollections = useSelector(childrenByParentUIDSelector);
    const { getTooltipProps, setTooltipRef, setTriggerRef, visible, triggerRef } = usePopperTooltip({
        visible: overlayOpen,
        placement: 'bottom',
        interactive: true,
        offset: [0, 0],
        trigger: 'click',
        onVisibleChange: (value) => {
            // ensure state is clean on opening the overlay
            if (value) {
                setSearch('');
                setAutoFocusButton(true);
            }
            setOverlayOpen(value);
        },
    });
    const handleFolderExpand = useCallback((uid, newOpenState) => __awaiter(this, void 0, void 0, function* () {
        setFolderOpenState((old) => (Object.assign(Object.assign({}, old), { [uid]: newOpenState })));
        if (newOpenState && !folderOpenState[uid]) {
            dispatch(fetchNextChildrenPage({ parentUID: uid, pageSize: PAGE_SIZE, excludeKinds: EXCLUDED_KINDS }));
        }
    }), [dispatch, folderOpenState]);
    const handleFolderSelect = useCallback((item) => {
        if (onChange) {
            onChange(item.uid, item.title);
        }
        setOverlayOpen(false);
    }, [onChange]);
    const handleCloseOverlay = useCallback(() => setOverlayOpen(false), [setOverlayOpen]);
    const baseHandleLoadMore = useLoadNextChildrenPage(EXCLUDED_KINDS);
    const handleLoadMore = useCallback((folderUID) => {
        if (search) {
            return;
        }
        baseHandleLoadMore(folderUID);
    }, [search, baseHandleLoadMore]);
    const flatTree = useMemo(() => {
        var _a;
        const searchResults = search && searchState.value;
        if (searchResults) {
            const searchCollection = {
                isFullyLoaded: true,
                lastKindHasMoreItems: false,
                lastFetchedKind: 'folder',
                lastFetchedPage: 1,
                items: (_a = searchResults.items) !== null && _a !== void 0 ? _a : [],
            };
            return createFlatTree(undefined, searchCollection, childrenCollections, {}, 0, EXCLUDED_KINDS, excludeUIDs);
        }
        let flatTree = createFlatTree(undefined, rootCollection, childrenCollections, folderOpenState, 0, EXCLUDED_KINDS, excludeUIDs);
        if (showRootFolder) {
            // Increase the level of each item to 'make way' for the fake root Dashboards item
            for (const item of flatTree) {
                item.level += 1;
            }
            flatTree.unshift({
                isOpen: true,
                level: 0,
                item: {
                    kind: 'folder',
                    title: 'Dashboards',
                    uid: '',
                },
            });
        }
        // If the root collection hasn't loaded yet, create loading placeholders
        if (!rootCollection) {
            flatTree = flatTree.concat(getPaginationPlaceholders(PAGE_SIZE, undefined, 0));
        }
        return flatTree;
    }, [search, searchState.value, rootCollection, childrenCollections, folderOpenState, excludeUIDs, showRootFolder]);
    const isItemLoaded = useCallback((itemIndex) => {
        const treeItem = flatTree[itemIndex];
        if (!treeItem) {
            return false;
        }
        const item = treeItem.item;
        const result = !(item.kind === 'ui' && item.uiKind === 'pagination-placeholder');
        return result;
    }, [flatTree]);
    const isLoading = rootStatus === 'pending' || searchState.loading;
    const { focusedItemIndex, handleKeyDown } = useTreeInteractions({
        tree: flatTree,
        handleCloseOverlay,
        handleFolderSelect,
        handleFolderExpand,
        idPrefix: overlayId,
        search,
        visible,
    });
    let label = (_a = selectedFolder.data) === null || _a === void 0 ? void 0 : _a.title;
    if (value === '') {
        label = 'Dashboards';
    }
    if (!visible) {
        return (React.createElement(Trigger, { label: label, invalid: invalid, isLoading: selectedFolder.isLoading, autoFocus: autoFocusButton, ref: setTriggerRef, "aria-label": label
                ? t('browse-dashboards.folder-picker.accessible-label', 'Select folder: {{ label }} currently selected', {
                    label,
                })
                : undefined }));
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(Input, { ref: setTriggerRef, autoFocus: true, prefix: label ? React.createElement(Icon, { name: "folder" }) : null, placeholder: label !== null && label !== void 0 ? label : t('browse-dashboards.folder-picker.search-placeholder', 'Search folders'), value: search, invalid: invalid, className: styles.search, onKeyDown: handleKeyDown, onChange: (e) => setSearch(e.currentTarget.value), "aria-autocomplete": "list", "aria-expanded": true, "aria-haspopup": true, "aria-controls": overlayId, "aria-owns": overlayId, "aria-activedescendant": getDOMId(overlayId, (_b = flatTree[focusedItemIndex]) === null || _b === void 0 ? void 0 : _b.item.uid), role: "combobox", suffix: React.createElement(Icon, { name: "search" }) }),
        React.createElement("fieldset", Object.assign({ ref: setTooltipRef, id: overlayId }, getTooltipProps({
            className: styles.tableWrapper,
            style: {
                width: triggerRef === null || triggerRef === void 0 ? void 0 : triggerRef.clientWidth,
            },
        })), error ? (React.createElement(Alert, { className: styles.error, severity: "warning", title: t('browse-dashboards.folder-picker.error-title', 'Error loading folders') }, error.message || ((_c = error.toString) === null || _c === void 0 ? void 0 : _c.call(error)) || t('browse-dashboards.folder-picker.unknown-error', 'Unknown error'))) : (React.createElement("div", null,
            isLoading && (React.createElement("div", { className: styles.loader },
                React.createElement(LoadingBar, { width: 600 }))),
            React.createElement(NestedFolderList, { items: flatTree, selectedFolder: value, focusedItemIndex: focusedItemIndex, onFolderExpand: handleFolderExpand, onFolderSelect: handleFolderSelect, idPrefix: overlayId, foldersAreOpenable: !(search && searchState.value), isItemLoaded: isItemLoaded, requestLoadMore: handleLoadMore }))))));
}
const getStyles = (theme) => {
    return {
        button: css({
            maxWidth: '100%',
        }),
        error: css({
            marginBottom: 0,
        }),
        tableWrapper: css({
            boxShadow: theme.shadows.z3,
            position: 'relative',
            zIndex: theme.zIndex.portal,
        }),
        loader: css({
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: theme.zIndex.portal + 1,
            overflow: 'hidden', // loading bar overflows its container, so we need to clip it
        }),
        search: css({
            input: {
                cursor: 'default',
            },
        }),
    };
};
//# sourceMappingURL=NestedFolderPicker.js.map