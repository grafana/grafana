export function createShape(options) {
    var _a;
    var baseBorderRadius = (_a = options.borderRadius) !== null && _a !== void 0 ? _a : 2;
    var borderRadius = function (amount) {
        var value = (amount !== null && amount !== void 0 ? amount : 1) * baseBorderRadius;
        return value + "px";
    };
    return {
        borderRadius: borderRadius,
    };
}
//# sourceMappingURL=createShape.js.map