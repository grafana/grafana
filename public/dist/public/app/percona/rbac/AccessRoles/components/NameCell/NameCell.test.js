import { render, screen } from '@testing-library/react';
import React from 'react';
import { stubRoles } from 'app/percona/rbac/__mocks__/stubs';
import NameCell from './NameCell';
describe('NameCell', () => {
    it("shows badge when it's a default role", () => {
        render(React.createElement(NameCell, { role: Object.assign(Object.assign({}, stubRoles[0]), { isDefault: true }) }));
        expect(screen.queryByTestId('role-default-badge')).not.toBeNull();
    });
    it("doesn't show badge when it's not a default role", () => {
        render(React.createElement(NameCell, { role: Object.assign(Object.assign({}, stubRoles[0]), { isDefault: false }) }));
        expect(screen.queryByTestId('role-default-badge')).toBeNull();
    });
});
//# sourceMappingURL=NameCell.test.js.map