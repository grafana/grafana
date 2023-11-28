export function withFocusedPanel(fn) {
    return () => {
        var _a, _b;
        const elements = document.querySelectorAll(':hover');
        for (let i = elements.length - 1; i > 0; i--) {
            const element = elements[i];
            if (element instanceof HTMLElement && ((_a = element.dataset) === null || _a === void 0 ? void 0 : _a.panelid)) {
                fn(parseInt((_b = element.dataset) === null || _b === void 0 ? void 0 : _b.panelid, 10));
            }
        }
    };
}
//# sourceMappingURL=withFocusedPanelId.js.map