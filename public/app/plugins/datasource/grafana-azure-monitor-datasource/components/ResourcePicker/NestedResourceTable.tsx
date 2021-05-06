import React from 'react';
import NestedRows from './NestedRows';
import { Row } from './types';

interface NestedResourceTableProps {
  rows: Row[];
}

const NestedResourceTable: React.FC<NestedResourceTableProps> = ({ rows }) => {
  return (
    <table>
      <thead>
        <tr>
          <td>Scope</td>
          <td>Type</td>
          <td>Location</td>
        </tr>
      </thead>

      <tbody>
        <NestedRows rows={rows} level={1} />
      </tbody>
    </table>
  );
};

export default NestedResourceTable;
