import Skeleton from 'react-loading-skeleton';

import { Text } from '@grafana/ui';

import { type DashboardsTreeCellProps } from '../types';

export function DescriptionCell({ row: { original: data } }: DashboardsTreeCellProps) {
  const item = data.item;

  if (item.kind === 'ui') {
    if (item.uiKind === 'pagination-placeholder') {
      return <Skeleton width={240} />;
    }

    return null;
  }

  if (!item.description) {
    return null;
  }

  return (
    <Text variant="body" color="secondary" truncate>
      {item.description}
    </Text>
  );
}
