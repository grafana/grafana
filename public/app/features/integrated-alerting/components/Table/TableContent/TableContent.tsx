import React, { FC } from 'react';
import { EmptyBlock } from '../../EmptyBlock';
import { TableContentProps } from './TableContent.types';

export const TableContent: FC<TableContentProps> = ({ hasData, emptyMessage, loading, children }) =>
  hasData ? <>{children}</> : <EmptyBlock dataQa="table-no-data">{!loading && <h1>{emptyMessage}</h1>}</EmptyBlock>;
