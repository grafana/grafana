import { css } from '@emotion/css';
import React from 'react';
import { CellProps } from 'react-table';

import { IconButton } from '../IconButton/IconButton';

const expanderContainerStyles = css({
  display: 'flex',
  alignItems: 'center',
  height: '100%',
});

export function ExpanderCell<K extends object>({ row, __rowID }: CellProps<K, void>) {
  return (
    <div className={expanderContainerStyles}>
      <IconButton
        tooltip="toggle row expanded"
        aria-controls={__rowID}
        name={row.isExpanded ? 'angle-down' : 'angle-right'}
        aria-expanded={row.isExpanded}
        {...row.getToggleRowExpandedProps()}
        size="lg"
      />
    </div>
  );
}
