import React, { FC } from 'react';

import Table from 'app/percona/rbac/AccessRoles/components/AccessRolesTable/Table';

import { Messages } from '../../AccessRole.messages';

import { COLUMNS } from './AccessRolesTable.constants';
import { AccessRolesTableProps } from './AccessRolesTable.types';

const AccessRolesTable: FC<AccessRolesTableProps> = ({ items }) => {
  return <Table emptyMessage={Messages.noRoles} columns={COLUMNS} data={items} totalItems={items.length} />;
};

export default AccessRolesTable;
