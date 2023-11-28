import { __awaiter } from "tslib";
import { useCallback, useState } from 'react';
import { useAsync } from 'react-use';
import { loadDashboards } from './api';
export function usePlaylistItems(playlistItems) {
    const [items, setItems] = useState(playlistItems !== null && playlistItems !== void 0 ? playlistItems : []);
    // Attach dashboards if any were missing
    useAsync(() => __awaiter(this, void 0, void 0, function* () {
        for (const item of items) {
            if (!item.dashboards) {
                setItems(yield loadDashboards(items));
                return;
            }
        }
    }), [items]);
    const addByUID = useCallback((dashboard) => {
        if (!dashboard) {
            return;
        }
        setItems([
            ...items,
            {
                type: 'dashboard_by_uid',
                value: dashboard.uid,
            },
        ]);
    }, [items]);
    const addByTag = useCallback((tags) => {
        const tag = tags[0];
        if (!tag || items.find((item) => item.value === tag)) {
            return;
        }
        const newItem = {
            type: 'dashboard_by_tag',
            value: tag,
        };
        setItems([...items, newItem]);
    }, [items]);
    const moveItem = useCallback((src, dst) => {
        if (src === dst || !items[src]) {
            return; // nothing to do
        }
        const update = Array.from(items);
        const [removed] = update.splice(src, 1);
        update.splice(dst, 0, removed);
        setItems(update);
    }, [items]);
    const deleteItem = useCallback((index) => {
        const copy = items.slice();
        copy.splice(index, 1);
        setItems(copy);
    }, [items]);
    return { items, addByUID, addByTag, deleteItem, moveItem };
}
//# sourceMappingURL=usePlaylistItems.js.map