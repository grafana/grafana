export const canvasMigrationHandler = (panel) => {
    var _a, _b;
    const pluginVersion = (_a = panel === null || panel === void 0 ? void 0 : panel.pluginVersion) !== null && _a !== void 0 ? _a : '';
    // Rename text-box to rectangle
    // Initial plugin version is empty string for first migration
    if (pluginVersion === '') {
        const root = (_b = panel.options) === null || _b === void 0 ? void 0 : _b.root;
        if (root === null || root === void 0 ? void 0 : root.elements) {
            for (const element of root.elements) {
                if (element.type === 'text-box') {
                    element.type = 'rectangle';
                }
            }
        }
    }
    return panel.options;
};
//# sourceMappingURL=migrations.js.map