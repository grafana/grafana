import { __read, __spreadArray } from "tslib";
import { useCallback, useState } from 'react';
export function usePlaylistItems(playlistItems) {
    var _a = __read(useState(playlistItems !== null && playlistItems !== void 0 ? playlistItems : []), 2), items = _a[0], setItems = _a[1];
    var addById = useCallback(function (dashboard) {
        if (!dashboard || items.find(function (item) { return item.id === dashboard.id; })) {
            return;
        }
        var newItem = {
            id: dashboard.id,
            title: dashboard.label,
            type: 'dashboard_by_id',
            value: dashboard.id.toString(10),
            order: items.length + 1,
        };
        setItems(__spreadArray(__spreadArray([], __read(items), false), [newItem], false));
    }, [items]);
    var addByTag = useCallback(function (tags) {
        var tag = tags[0];
        if (!tag || items.find(function (item) { return item.value === tag; })) {
            return;
        }
        var newItem = {
            title: tag,
            type: 'dashboard_by_tag',
            value: tag,
            order: items.length + 1,
        };
        setItems(__spreadArray(__spreadArray([], __read(items), false), [newItem], false));
    }, [items]);
    var movePlaylistItem = useCallback(function (item, offset) {
        var newItems = __spreadArray([], __read(items), false);
        var currentPosition = newItems.indexOf(item);
        var newPosition = currentPosition + offset;
        if (newPosition >= 0 && newPosition < newItems.length) {
            newItems.splice(currentPosition, 1);
            newItems.splice(newPosition, 0, item);
        }
        setItems(newItems);
    }, [items]);
    var moveUp = useCallback(function (item) {
        movePlaylistItem(item, -1);
    }, [movePlaylistItem]);
    var moveDown = useCallback(function (item) {
        movePlaylistItem(item, 1);
    }, [movePlaylistItem]);
    var deleteItem = useCallback(function (item) {
        setItems(items.filter(function (i) { return i !== item; }));
    }, [items]);
    return { items: items, addById: addById, addByTag: addByTag, deleteItem: deleteItem, moveDown: moveDown, moveUp: moveUp };
}
//# sourceMappingURL=usePlaylistItems.js.map