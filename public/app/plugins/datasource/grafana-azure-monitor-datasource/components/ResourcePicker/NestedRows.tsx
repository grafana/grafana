import React from 'react';
import NestedRow from './NestedRow';

import { ResourceRow, ResourceRowGroup, ResourceRowType } from './types';

interface NestedRowsProps {
  rows: ResourceRowGroup;
  level: number;
  selectedRows: ResourceRowGroup;
  requestNestedRows: (row: ResourceRow) => Promise<void>;
  onRowSelectedChange: (row: ResourceRow, selected: boolean) => void;
  selectableEntryTypes: ResourceRowType[];
}

const NestedRows: React.FC<NestedRowsProps> = ({
  rows,
  selectedRows,
  level,
  requestNestedRows,
  onRowSelectedChange,
  selectableEntryTypes,
}) => (
  <>
    {rows.map((row) => (
      <NestedRow
        key={row.id}
        row={row}
        selectedRows={selectedRows}
        level={level}
        requestNestedRows={requestNestedRows}
        onRowSelectedChange={onRowSelectedChange}
        selectableEntryTypes={selectableEntryTypes}
      />
    ))}
  </>
);

export default NestedRows;
