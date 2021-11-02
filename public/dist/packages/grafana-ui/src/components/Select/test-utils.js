import { __awaiter, __generator } from "tslib";
import { select } from 'react-select-event';
// Used to select an option or options from a Select in unit tests
export var selectOptionInTest = function (input, optionOrOptions) { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
    switch (_a.label) {
        case 0: return [4 /*yield*/, select(input, optionOrOptions, { container: document.body })];
        case 1: return [2 /*return*/, _a.sent()];
    }
}); }); };
//# sourceMappingURL=test-utils.js.map