import { css } from '@emotion/css';
import React from 'react';
import { CellProps } from 'react-table';

import { IconButton } from '../IconButton/IconButton';

const expanderContainerStyles = css`
  display: flex;
  align-items: center;
  height: 100%;
`;

export function ExpanderCell<K extends object>({ row, __rowID }: CellProps<K, void>) {
  return (
    <div className={expanderContainerStyles}>
      <IconButton
        tooltip="toggle row expanded"
        aria-controls={__rowID}
        // @ts-expect-error react-table doesn't ship with useExpanded types and we can't use declaration merging without affecting the table viz
        name={row.isExpanded ? 'angle-down' : 'angle-right'}
        // @ts-expect-error same as the line above
        aria-expanded={row.isExpanded}
        // @ts-expect-error same as the line above
        {...row.getToggleRowExpandedProps()}
      />
    </div>
  );
}
