export function findCreateActions(navTree) {
    const results = [];
    for (const navItem of navTree) {
        if (navItem.isCreateAction) {
            results.push(navItem);
        }
        if (navItem.children) {
            results.push(...findCreateActions(navItem.children));
        }
    }
    return results;
}
//# sourceMappingURL=utils.js.map