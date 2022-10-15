import { css } from '@emotion/css';
import React from 'react';
import { CellProps } from 'react-table';

import { IconButton } from '@grafana/ui';

const expanderContainerStyles = css`
  display: flex;
  align-items: center;
  height: 100%;
`;

export function ExpanderCell<K extends object>({ row }: CellProps<K, void>) {
  return (
    <div className={expanderContainerStyles}>
      <IconButton
        // @ts-expect-error react-table doesn't ship with useExpanded types and we can't use declaration merging without affecting the table viz
        name={row.isExpanded ? 'angle-down' : 'angle-right'}
        // @ts-expect-error same as the line above
        {...row.getToggleRowExpandedProps({})}
      />
    </div>
  );
}
