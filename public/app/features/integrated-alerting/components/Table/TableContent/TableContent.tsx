import React, { FC } from 'react';
import { Spinner } from '@grafana/ui';
import { EmptyBlock } from '../../EmptyBlock';
import { TableContentProps } from './TableContent.types';

export const TableContent: FC<TableContentProps> = ({ pending, hasData, emptyMessage, children }) => {
  if (pending) {
    return (
      <EmptyBlock dataQa="table-loading">
        <Spinner />
      </EmptyBlock>
    );
  }

  if (!hasData) {
    return <EmptyBlock dataQa="table-no-data">{<h1>{emptyMessage}</h1>}</EmptyBlock>;
  }

  return <>{children}</>;
};
