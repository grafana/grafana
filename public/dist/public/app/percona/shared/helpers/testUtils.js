import { __awaiter } from "tslib";
import { act } from 'react-dom/test-utils';
export const asyncAct = (cb) => {
    //@ts-ignore
    return act(() => __awaiter(void 0, void 0, void 0, function* () { return cb(); }));
};
//# sourceMappingURL=testUtils.js.map