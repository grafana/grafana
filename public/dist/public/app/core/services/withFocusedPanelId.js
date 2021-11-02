export function withFocusedPanel(fn) {
    return function () {
        var _a, _b;
        var elements = document.querySelectorAll(':hover');
        for (var i = elements.length - 1; i > 0; i--) {
            var element = elements[i];
            if ((_a = element.dataset) === null || _a === void 0 ? void 0 : _a.panelid) {
                fn(parseInt((_b = element.dataset) === null || _b === void 0 ? void 0 : _b.panelid, 10));
            }
        }
    };
}
//# sourceMappingURL=withFocusedPanelId.js.map