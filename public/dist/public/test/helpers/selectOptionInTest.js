import { __awaiter } from "tslib";
import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { select } from 'react-select-event';
import { byRole } from 'testing-library-selector';
// Used to select an option or options from a Select in unit tests
export const selectOptionInTest = (input, optionOrOptions) => __awaiter(void 0, void 0, void 0, function* () { return yield waitFor(() => select(input, optionOrOptions, { container: document.body })); });
// Finds the parent of the Select so you can assert if it has a value
export const getSelectParent = (input) => { var _a, _b, _c, _d; return (_d = (_c = (_b = (_a = input.parentElement) === null || _a === void 0 ? void 0 : _a.parentElement) === null || _b === void 0 ? void 0 : _b.parentElement) === null || _c === void 0 ? void 0 : _c.parentElement) === null || _d === void 0 ? void 0 : _d.parentElement; };
export const clickSelectOption = (selectElement, optionText) => __awaiter(void 0, void 0, void 0, function* () {
    yield userEvent.click(byRole('combobox').get(selectElement));
    yield selectOptionInTest(selectElement, optionText);
});
export const clickSelectOptionMatch = (selectElement, optionText) => __awaiter(void 0, void 0, void 0, function* () {
    yield userEvent.click(byRole('combobox').get(selectElement));
    yield selectOptionInTest(selectElement, optionText);
});
//# sourceMappingURL=selectOptionInTest.js.map