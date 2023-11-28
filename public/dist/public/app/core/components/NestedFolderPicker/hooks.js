import { useCallback, useEffect, useState } from 'react';
import { getDOMId } from './NestedFolderList';
export function useTreeInteractions({ tree, handleCloseOverlay, handleFolderSelect, handleFolderExpand, idPrefix, search, visible, }) {
    const [focusedItemIndex, setFocusedItemIndex] = useState(-1);
    useEffect(() => {
        if (visible) {
            setFocusedItemIndex(-1);
        }
    }, [visible]);
    useEffect(() => {
        setFocusedItemIndex(0);
    }, [search]);
    useEffect(() => {
        var _a, _b;
        (_b = document
            .getElementById(getDOMId(idPrefix, (_a = tree[focusedItemIndex]) === null || _a === void 0 ? void 0 : _a.item.uid))) === null || _b === void 0 ? void 0 : _b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, [focusedItemIndex, idPrefix, tree]);
    const handleKeyDown = useCallback((ev) => {
        const foldersAreOpenable = !search;
        switch (ev.key) {
            // Expand/collapse folder on right/left arrow keys
            case 'ArrowRight':
            case 'ArrowLeft':
                if (foldersAreOpenable) {
                    ev.preventDefault();
                    handleFolderExpand(tree[focusedItemIndex].item.uid, ev.key === 'ArrowRight');
                }
                break;
            case 'ArrowUp':
                if (focusedItemIndex > 0) {
                    ev.preventDefault();
                    setFocusedItemIndex(focusedItemIndex - 1);
                }
                break;
            case 'ArrowDown':
                if (focusedItemIndex < tree.length - 1) {
                    ev.preventDefault();
                    setFocusedItemIndex(focusedItemIndex + 1);
                }
                break;
            case 'Enter':
                ev.preventDefault();
                const item = tree[focusedItemIndex].item;
                if (item.kind === 'folder') {
                    handleFolderSelect(item);
                }
                break;
            case 'Tab':
                ev.stopPropagation();
                handleCloseOverlay();
                break;
            case 'Escape':
                ev.stopPropagation();
                ev.preventDefault();
                handleCloseOverlay();
                break;
        }
    }, [focusedItemIndex, handleCloseOverlay, handleFolderExpand, handleFolderSelect, search, tree]);
    return {
        focusedItemIndex,
        handleKeyDown,
    };
}
//# sourceMappingURL=hooks.js.map