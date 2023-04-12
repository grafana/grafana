import { css, cx } from '@emotion/css';
import React from 'react';
import { Column, ColumnGroup, Row } from 'react-table';

import { Action } from 'app/percona/dbaas/components/MultipleActions/MultipleActions.types';

import { ExpandAndActionsCol } from '../components/Elements/ExpandAndActionsCol/ExpandAndActionsCol';

export const getExpandAndActionsCol = <T extends object>(
  actionsGetter: (row: Row<T>) => Action[] = () => [],
  children?: React.ReactNode,
  className?: string,
  options?: ColumnGroup<T>
): Column<T> => {
  return {
    Header: 'Options',
    Cell: ({ row }: { row: Row<T> }) => (
      <ExpandAndActionsCol actions={actionsGetter(row)} row={row}>
        {children}
      </ExpandAndActionsCol>
    ),
    // @ts-ignore
    className: cx(
      css`
        &[role='columnheader'] {
          text-align: right;
        }
      `,
      !children &&
        css`
          width: 70px;
        `,
      className
    ),
    ...options,
  };
};
