import { __assign, __awaiter, __generator } from "tslib";
import { useAsync } from 'react-use';
// Allows simple dynamic imports in the components
export var useAsyncDependency = function (importStatement) {
    var state = useAsync(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, importStatement];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); });
    return __assign(__assign({}, state), { dependency: state.value });
};
//# sourceMappingURL=useAsyncDependency.js.map