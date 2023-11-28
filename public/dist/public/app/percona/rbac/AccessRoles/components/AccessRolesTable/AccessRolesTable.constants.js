import React from 'react';
import { Messages } from '../../AccessRole.messages';
import MetricsCell from '../MetricsCell';
import MetricsColumn from '../MetricsColumn';
import NameCell from '../NameCell';
import OptionsCell from '../OptionsCell';
export const COLUMNS = [
    {
        Header: Messages.name.column,
        accessor: (role) => React.createElement(NameCell, { role: role }),
    },
    {
        Header: Messages.description.column,
        accessor: 'description',
    },
    {
        Header: React.createElement(MetricsColumn, null),
        accessor: 'filter',
        Cell: (cell) => React.createElement(MetricsCell, { filter: cell.value || '' }),
    },
    {
        Header: Messages.options.column,
        width: '50px',
        accessor: (role) => React.createElement(OptionsCell, { role: role }),
    },
];
//# sourceMappingURL=AccessRolesTable.constants.js.map