import { Checkbox, IconButton } from '@grafana/ui';
import React from 'react';
import { Row } from './types';

interface NestedRowsProps {
  rows: Row[];
  level: number;
}

const NestedRows: React.FC<NestedRowsProps> = ({ rows, level }) => {
  return (
    <>
      {rows.map((row) => (
        <>
          <tr key={row.id}>
            <td>
              <NestedEntry level={level} hasChildren={!!row.hasChildren} isSelectable={!!row.isSelectable}>
                {row.name}
              </NestedEntry>
            </td>
            <td>{row.typeLabel}</td>
            <td>{row.location ?? '-'}</td>
          </tr>

          {row.children && <NestedRows rows={row.children} level={level + 1} />}
        </>
      ))}
    </>
  );
};

interface NestedEntryProps {
  hasChildren: boolean;
  isOpen?: boolean;
  level: number;
  isSelectable: boolean;
}

const NestedEntry: React.FC<NestedEntryProps> = ({ hasChildren, children, isSelectable, level }) => {
  return (
    <div style={{ marginLeft: level * 16 }}>
      {hasChildren && <IconButton name="angle-right" />}
      {isSelectable && <Checkbox />}
      {children}
    </div>
  );
};

export default NestedRows;
