import React from 'react';
import Table from 'app/percona/rbac/AccessRoles/components/AccessRolesTable/Table';
import { Messages } from '../../AccessRole.messages';
import { COLUMNS } from './AccessRolesTable.constants';
const AccessRolesTable = ({ items }) => {
    return React.createElement(Table, { emptyMessage: Messages.noRoles, columns: COLUMNS, data: items, totalItems: items.length });
};
export default AccessRolesTable;
//# sourceMappingURL=AccessRolesTable.js.map