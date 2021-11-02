export var applyStateChanges = function (state) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    return args.reduce(function (all, cur) {
        return cur(all);
    }, state);
};
//# sourceMappingURL=applyStateChanges.js.map