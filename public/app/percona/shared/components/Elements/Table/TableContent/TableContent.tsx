import React, { FC } from 'react';

import { EmptyBlock } from 'app/percona/shared/components/Elements/EmptyBlock';

import { TableContentProps } from './TableContent.types';

export const TableContent: FC<React.PropsWithChildren<TableContentProps>> = ({
  hasData,
  emptyMessage,
  emptyMessageClassName,
  loading,
  children,
}) =>
  hasData ? (
    <>{children}</>
  ) : emptyMessageClassName ? (
    <div data-testid="table-no-data" className={emptyMessageClassName}>
      {!loading && <h1>{emptyMessage}</h1>}
    </div>
  ) : (
    <EmptyBlock dataTestId="table-no-data">
      {!loading && (typeof emptyMessage === 'string' ? <h1>{emptyMessage}</h1> : emptyMessage)}
    </EmptyBlock>
  );
