import React, { FC } from 'react';
import { Column } from 'app/percona/check/types';

interface TableHeaderProps {
  columns: Column[];
}

export const TableHeader: FC<TableHeaderProps> = ({ columns }) => {
  const widths = columns.map((col) => col.width);
  const titles = columns.map((col) => col.title);

  return (
    <>
      <colgroup>
        {widths.map((width, key) => (
          <col key={key} style={width ? { width: `${width}px`, minWidth: `${width}px` } : {}} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {titles.map((title, key) => (
            <th key={key}>{title}</th>
          ))}
        </tr>
      </thead>
    </>
  );
};
