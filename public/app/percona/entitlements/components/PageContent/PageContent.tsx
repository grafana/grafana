import React, { FC } from 'react';

import { EmptyBlock } from 'app/percona/shared/components/Elements/EmptyBlock';

import { PageContentProps } from './PageContent.types';

export const PageContent: FC<React.PropsWithChildren<PageContentProps>> = ({ hasData, emptyMessage, loading, children }) =>
  hasData ? <>{children}</> : <EmptyBlock dataTestId="page-no-data">{!loading && <h1>{emptyMessage}</h1>}</EmptyBlock>;
