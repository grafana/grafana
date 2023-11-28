import { __awaiter } from "tslib";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TeamSettings } from './TeamSettings';
import { getMockTeam } from './__mocks__/teamMocks';
jest.mock('app/core/services/context_srv', () => ({
    contextSrv: {
        licensedAccessControlEnabled: () => false,
        hasPermission: () => true,
        hasPermissionInMetadata: () => true,
        user: { orgId: 1 },
    },
}));
jest.mock('app/core/components/SharedPreferences/SharedPreferences', () => {
    return { SharedPreferences: () => React.createElement("div", null) };
});
jest.mock('app/core/components/RolePicker/hooks', () => ({
    useRoleOptions: jest.fn().mockReturnValue([{ roleOptions: [] }, jest.fn()]),
}));
const setup = (propOverrides) => {
    const props = {
        team: getMockTeam(),
        updateTeam: jest.fn(),
    };
    Object.assign(props, propOverrides);
    render(React.createElement(TeamSettings, Object.assign({}, props)));
};
describe('Team settings', () => {
    it('should render component', () => {
        setup();
        expect(screen.getByText('Team details')).toBeInTheDocument();
    });
    it('should validate required fields', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockUpdate = jest.fn();
        setup({ updateTeam: mockUpdate });
        yield userEvent.clear(screen.getByRole('textbox', { name: /Name/ }));
        yield userEvent.type(screen.getByLabelText(/Email/i), 'team@test.com');
        // Submitting with userEvent doesn't work here
        fireEvent.submit(screen.getByRole('button', { name: 'Update' }));
        expect(yield screen.findByText('Name is required')).toBeInTheDocument();
        yield waitFor(() => expect(mockUpdate).not.toHaveBeenCalled());
    }));
    it('should submit form with correct values', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockUpdate = jest.fn();
        setup({ updateTeam: mockUpdate });
        yield userEvent.clear(screen.getByRole('textbox', { name: /Name/ }));
        yield userEvent.clear(screen.getByLabelText(/Email/i));
        yield userEvent.type(screen.getByRole('textbox', { name: /Name/ }), 'New team');
        yield userEvent.type(screen.getByLabelText(/Email/i), 'team@test.com');
        // Submitting with userEvent doesn't work here
        fireEvent.submit(screen.getByRole('button', { name: 'Update' }));
        yield waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('New team', 'team@test.com'));
    }));
});
//# sourceMappingURL=TeamSettings.test.js.map