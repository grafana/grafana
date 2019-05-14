import { memoize } from 'lodash';
import { createSelectorCreator } from 'reselect';
var hashFn = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    return args.reduce(function (acc, val) { return acc + '-' + JSON.stringify(val); }, '');
};
export var createLodashMemoizedSelector = createSelectorCreator(memoize, hashFn);
//# sourceMappingURL=reselect.js.map