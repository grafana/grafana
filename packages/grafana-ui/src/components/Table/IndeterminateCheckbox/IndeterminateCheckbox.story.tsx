import React from 'react';

import { IndeterminateCheckbox } from './IndeterminateCheckbox';
import { ReactTable, makeData } from './fixturesHelpers';

export default {
  title: 'Table/IndeterminateCheckbox',
  component: IndeterminateCheckbox,
};

export const ControlledReactTable = () => {
  const columns = React.useMemo(
    () => [
      {
        Header: 'First Name',
        accessor: 'firstName',
      },
      {
        Header: 'Age',
        accessor: 'age',
      },
      {
        Header: 'Visits',
        accessor: 'visits',
      },
    ],

    []
  );
  const data = React.useMemo(() => makeData(5), []);

  return <ReactTable columns={columns} data={data} />;
};
