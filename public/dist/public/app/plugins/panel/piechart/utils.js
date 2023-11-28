export function filterDisplayItems(item) {
    var _a, _b;
    return !((_b = (_a = item.field.custom) === null || _a === void 0 ? void 0 : _a.hideFrom) === null || _b === void 0 ? void 0 : _b.viz) && !isNaN(item.display.numeric);
}
export function sumDisplayItemsReducer(acc, item) {
    return item.display.numeric + acc;
}
//# sourceMappingURL=utils.js.map