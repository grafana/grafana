import { Row } from 'react-table';

import { Action } from 'app/percona/dbaas/components/MultipleActions/MultipleActions.types';

export interface ExpandAndActionsColProps<T extends object> {
  row: Row<T>;
  loading?: boolean;
  actions?: Action[];
  className?: string;
}
