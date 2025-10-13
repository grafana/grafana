import { Row } from 'react-table';

import { IconName } from '@grafana/ui';

export interface ExpandableCellProps {
  row: Row<any>;
  value: any;
  collapsedIconName?: IconName;
  expandedIconName?: IconName;
}
