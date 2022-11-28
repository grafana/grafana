import { css } from '@emotion/css';
import React from 'react';
import { CellProps } from 'react-table';

import { IconButton } from '@grafana/ui';

const expanderContainerStyles = css`
  display: flex;
  align-items: center;
  height: 100%;
`;

export const ExpanderCell = ({ row }: CellProps<object, void>) => (
  <div className={expanderContainerStyles}>
    <IconButton
      name={row.isExpanded ? 'angle-down' : 'angle-right'}
      // @ts-expect-error same as the line above
      {...row.getToggleRowExpandedProps({})}
    />
  </div>
);
