export function fullyLoadedViewItemCollection(items) {
    var _a, _b;
    const lastKind = (_b = (_a = items.at(-1)) === null || _a === void 0 ? void 0 : _a.kind) !== null && _b !== void 0 ? _b : 'folder';
    if (!lastKind || lastKind === 'panel') {
        throw new Error('invalid items');
    }
    return {
        items,
        lastFetchedKind: lastKind,
        lastFetchedPage: 1,
        lastKindHasMoreItems: false,
        isFullyLoaded: true,
    };
}
//# sourceMappingURL=state.fixtures.js.map