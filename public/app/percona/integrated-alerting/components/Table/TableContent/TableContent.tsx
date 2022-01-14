import React, { FC } from 'react';
import { EmptyBlock } from 'app/percona/shared/components/Elements/EmptyBlock';
import { TableContentProps } from './TableContent.types';

export const TableContent: FC<TableContentProps> = ({ hasData, emptyMessage, loading, children }) =>
  hasData ? <>{children}</> : <EmptyBlock dataTestId="table-no-data">{!loading && <h1>{emptyMessage}</h1>}</EmptyBlock>;
