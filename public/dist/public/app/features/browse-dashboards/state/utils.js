export function findItem(rootItems, childrenByUID, uid) {
    for (const item of rootItems) {
        if (item.uid === uid) {
            return item;
        }
    }
    for (const parentUID in childrenByUID) {
        const children = childrenByUID[parentUID];
        if (!children) {
            continue;
        }
        for (const child of children.items) {
            if (child.uid === uid) {
                return child;
            }
        }
    }
    return undefined;
}
export function getPaginationPlaceholders(amount, parentUID, level) {
    return new Array(amount).fill(null).map((_, index) => {
        return {
            parentUID,
            level,
            isOpen: false,
            item: {
                kind: 'ui',
                uiKind: 'pagination-placeholder',
                uid: `${parentUID}-pagination-${index}`,
            },
        };
    });
}
//# sourceMappingURL=utils.js.map