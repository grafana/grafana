import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { UserPicker } from './UserPicker';
jest.mock('@grafana/runtime', () => ({
    getBackendSrv: () => ({ get: jest.fn().mockResolvedValue([]) }),
}));
describe('UserPicker', () => {
    it('renders correctly', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(UserPicker, { onSelected: () => { } }));
        expect(yield screen.findByTestId('userPicker')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=UserPicker.test.js.map