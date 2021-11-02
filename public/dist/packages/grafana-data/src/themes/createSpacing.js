// Code based on Material UI
// The MIT License (MIT)
// Copyright (c) 2014 Call-Em-All
/** @internal */
export function createSpacing(options) {
    if (options === void 0) { options = {}; }
    var _a = options.gridSize, gridSize = _a === void 0 ? 8 : _a;
    var transform = function (value) {
        if (typeof value === 'string') {
            return value;
        }
        if (process.env.NODE_ENV !== 'production') {
            if (typeof value !== 'number') {
                console.error("Expected spacing argument to be a number or a string, got " + value + ".");
            }
        }
        return value * gridSize;
    };
    var spacing = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (process.env.NODE_ENV !== 'production') {
            if (!(args.length <= 4)) {
                console.error("Too many arguments provided, expected between 0 and 4, got " + args.length);
            }
        }
        if (args.length === 0) {
            args[0] = 1;
        }
        return args
            .map(function (argument) {
            var output = transform(argument);
            return typeof output === 'number' ? output + "px" : output;
        })
            .join(' ');
    };
    spacing.gridSize = gridSize;
    return spacing;
}
//# sourceMappingURL=createSpacing.js.map