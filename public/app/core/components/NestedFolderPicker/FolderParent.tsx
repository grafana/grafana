import Skeleton from 'react-loading-skeleton';

import { Text } from '@grafana/ui';

import { useGetFolderQueryFacade } from '../../../api/clients/folder/v1beta1/hooks';
import { DashboardsTreeItem } from '../../../features/browse-dashboards/types';

export function FolderParent({ item }: { item: DashboardsTreeItem }) {
  if (item.item.kind !== 'folder') {
    return null;
  }

  if (item.item.parentTitle) {
    return (
      <Text variant={'bodySmall'} color={'secondary'} truncate>
        {item.item.parentTitle}/
      </Text>
    );
  }

  if (item.item.parentUID || item.parentUID) {
    return <NetworkFolderParent uid={(item.item.parentUID || item.parentUID)!} />;
  }

  return null;
}

function NetworkFolderParent({ uid }: { uid: string }) {
  const result = useGetFolderQueryFacade(uid);

  if (result.isLoading) {
    return <Skeleton width={50} />;
  }

  if (result.data) {
    return (
      <Text variant={'bodySmall'} color={'secondary'} truncate>
        {result.data.title}/
      </Text>
    );
  }

  return null;
}
