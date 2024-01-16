import { PropsWithChildren } from 'react';

export interface TableContentProps extends PropsWithChildren {
  hasData: boolean;
  emptyMessage: React.ReactNode;
  emptyMessageClassName?: string;
  loading?: boolean;
}
