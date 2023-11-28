import { __awaiter } from "tslib";
import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { OrgPicker } from './OrgPicker';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => ({
        get: () => Promise.resolve([
            { name: 'Org 1', id: 0 },
            { name: 'Org 2', id: 1 },
        ]),
    }) })));
function setup(jsx) {
    return Object.assign({ user: userEvent.setup() }, render(jsx));
}
describe('OrgPicker', () => {
    it('should render', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(React.Fragment, null,
            React.createElement("label", { htmlFor: 'picker' }, "Org picker"),
            React.createElement(OrgPicker, { onSelected: () => { }, inputId: 'picker' })));
        expect(yield screen.findByRole('combobox', { name: 'Org picker' })).toBeInTheDocument();
    }));
    it('should have the options', () => __awaiter(void 0, void 0, void 0, function* () {
        const { user } = setup(React.createElement(React.Fragment, null,
            React.createElement("label", { htmlFor: 'picker' }, "Org picker"),
            React.createElement(OrgPicker, { onSelected: () => { }, inputId: 'picker' })));
        yield user.click(yield screen.findByRole('combobox', { name: 'Org picker' }));
        expect(screen.getByText('Org 1')).toBeInTheDocument();
        expect(screen.getByText('Org 2')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=OrgPicker.test.js.map