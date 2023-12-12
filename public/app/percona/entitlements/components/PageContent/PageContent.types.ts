import { PropsWithChildren } from 'react';

export interface PageContentProps extends PropsWithChildren {
  hasData: boolean;
  emptyMessage: string;
  loading?: boolean;
}
