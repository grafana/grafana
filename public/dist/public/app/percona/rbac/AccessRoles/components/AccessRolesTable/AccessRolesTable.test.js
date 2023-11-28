import { render } from '@testing-library/react';
import React from 'react';
import AccessRolesTable from './AccessRolesTable';
describe('AccessRolesTable', () => {
    it('renders empty message when no roles are provided', () => {
        render(React.createElement(AccessRolesTable, { items: [] }));
    });
});
//# sourceMappingURL=AccessRolesTable.test.js.map