import React from 'react';
import { render, screen } from '@testing-library/react';
import { UserPicker } from './UserPicker';
jest.mock('@grafana/runtime', function () { return ({
    getBackendSrv: function () { return ({ get: jest.fn().mockResolvedValue([]) }); },
}); });
describe('UserPicker', function () {
    it('renders correctly', function () {
        render(React.createElement(UserPicker, { onSelected: function () { } }));
        expect(screen.getByTestId('userPicker')).toBeInTheDocument();
    });
});
//# sourceMappingURL=UserPicker.test.js.map