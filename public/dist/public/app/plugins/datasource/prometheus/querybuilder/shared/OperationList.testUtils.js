import { __awaiter } from "tslib";
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
export function addOperation(section, op) {
    return __awaiter(this, void 0, void 0, function* () {
        const addOperationButton = screen.getByTitle('Add operation');
        expect(addOperationButton).toBeInTheDocument();
        yield userEvent.click(addOperationButton);
        const sectionItem = yield screen.findByTitle(section);
        expect(sectionItem).toBeInTheDocument();
        // Weirdly the await userEvent.click doesn't work here, it reports the item has pointer-events: none. Don't see that
        // anywhere when debugging so not sure what style is it picking up.
        yield userEvent.click(sectionItem.children[0], { pointerEventsCheck: 0 });
        const opItem = screen.getByTitle(op);
        expect(opItem).toBeInTheDocument();
        // Weirdly the await userEvent.click doesn't work here, it reports the item has pointer-events: none. Don't see that
        // anywhere when debugging so not sure what style is it picking up.
        yield userEvent.click(opItem, { pointerEventsCheck: 0 });
    });
}
//# sourceMappingURL=OperationList.testUtils.js.map