import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import OrgProfile from './OrgProfile';
jest.mock('app/core/core', () => {
    return {
        contextSrv: {
            hasPermission: () => true,
        },
    };
});
describe('OrgProfile', () => {
    const props = {
        orgName: 'Main org',
        onSubmit: jest.fn(),
    };
    it('should render without crashing', () => {
        expect(() => render(React.createElement(OrgProfile, Object.assign({}, props)))).not.toThrow();
    });
    it('should show the current org name', () => {
        render(React.createElement(OrgProfile, Object.assign({}, props)));
        const orgNameInput = screen.getByLabelText('Organization name');
        expect(orgNameInput).toHaveValue('Main org');
    });
    it('can update the current org name', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(OrgProfile, Object.assign({}, props)));
        const orgNameInput = screen.getByLabelText('Organization name');
        const submitButton = screen.getByRole('button', { name: 'Update organization name' });
        expect(orgNameInput).toHaveValue('Main org');
        yield userEvent.clear(orgNameInput);
        yield userEvent.type(orgNameInput, 'New org name');
        yield userEvent.click(submitButton);
        expect(props.onSubmit).toHaveBeenCalledWith('New org name');
    }));
});
//# sourceMappingURL=OrgProfile.test.js.map