export function isSoloRoute(path) {
    return /(d-solo|dashboard-solo)/.test(path === null || path === void 0 ? void 0 : path.toLowerCase());
}
export function pluginHasRootPage(pluginId, navTree) {
    var _a, _b, _c, _d;
    return Boolean((_d = (_c = (_b = (_a = navTree
        .find((navLink) => navLink.id === 'apps')) === null || _a === void 0 ? void 0 : _a.children) === null || _b === void 0 ? void 0 : _b.find((app) => app.id === `plugin-page-${pluginId}`)) === null || _c === void 0 ? void 0 : _c.children) === null || _d === void 0 ? void 0 : _d.some((page) => { var _a; return (_a = page.url) === null || _a === void 0 ? void 0 : _a.endsWith(`/a/${pluginId}`); }));
}
//# sourceMappingURL=utils.js.map