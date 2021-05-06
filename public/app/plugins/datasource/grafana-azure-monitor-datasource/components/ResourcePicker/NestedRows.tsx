import { Checkbox, HorizontalGroup, IconButton, useStyles2, useTheme2 } from '@grafana/ui';
import React from 'react';
import getStyles from './styles';
import { Row } from './types';

interface NestedRowsProps {
  rows: Row[];
  level: number;
}

const NestedRows: React.FC<NestedRowsProps> = ({ rows, level }) => {
  const styles = useStyles2(getStyles);

  return (
    <>
      {rows.map((row) => (
        <>
          <tr key={row.id}>
            <td className={styles.cell}>
              <NestedEntry level={level} hasChildren={!!row.hasChildren} isSelectable={!!row.isSelectable}>
                {row.name}
              </NestedEntry>
            </td>

            <td className={styles.cell}>{row.typeLabel}</td>

            <td className={styles.cell}>{row.location ?? '-'}</td>
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
  const theme = useTheme2();

  return (
    <div style={{ marginLeft: level * (2 * theme.spacing.gridSize) }}>
      <HorizontalGroup align="center">
        {hasChildren && <IconButton name="angle-right" />}
        {isSelectable && <Checkbox />}
        {children}
      </HorizontalGroup>
    </div>
  );
};

export default NestedRows;
