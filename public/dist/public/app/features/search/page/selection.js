export function newSearchSelection() {
    // the check is called often, on potentially large (all) results so using Map/Set is better than simple array
    const items = new Map();
    const isSelected = (kind, uid) => {
        var _a;
        return Boolean((_a = items.get(kind)) === null || _a === void 0 ? void 0 : _a.has(uid));
    };
    return {
        items,
        isSelected,
    };
}
export function updateSearchSelection(old, selected, kind, uids) {
    const items = old.items; // mutate! :/
    if (uids.length) {
        const k = items.get(kind);
        if (k) {
            for (const uid of uids) {
                if (selected) {
                    k.add(uid);
                }
                else {
                    k.delete(uid);
                }
            }
            if (k.size < 1) {
                items.delete(kind);
            }
        }
        else if (selected) {
            items.set(kind, new Set(uids));
        }
    }
    return {
        items,
        isSelected: (kind, uid) => {
            var _a, _b, _c;
            if (uid === '*') {
                if (kind === '*') {
                    for (const k of items.keys()) {
                        if ((_a = items.get(k)) === null || _a === void 0 ? void 0 : _a.size) {
                            return true;
                        }
                    }
                    return false;
                }
                return Boolean((_b = items.get(kind)) === null || _b === void 0 ? void 0 : _b.size);
            }
            return Boolean((_c = items.get(kind)) === null || _c === void 0 ? void 0 : _c.has(uid));
        },
    };
}
//# sourceMappingURL=selection.js.map