import { memo } from 'react';
import Skeleton from 'react-loading-skeleton';

import { Box, Text } from '@grafana/ui';

import { useGetFolderQueryFacade } from '../../../api/clients/folder/v1beta1/hooks';
import { DashboardsTreeItem } from '../../../features/browse-dashboards/types';

interface ParentTextProps {
  folder: string;
}

function ParentText({ folder }: ParentTextProps) {
  return (
    <Box marginLeft={1}>
      <Text variant={'bodySmall'} color={'secondary'} truncate>
        /{folder}
      </Text>
    </Box>
  );
}

export const FolderParent = memo(function FolderParent({ item }: { item: DashboardsTreeItem }) {
  if (item.item.kind !== 'folder') {
    return null;
  }

  if (item.item.parentTitle) {
    return <ParentText folder={item.item.parentTitle} />;
  }

  const parentUID = item.item.parentUID || item.parentUID;

  if (parentUID) {
    return <NetworkFolderParent uid={parentUID} />;
  }

  return null;
});

function NetworkFolderParent({ uid }: { uid: string }) {
  const result = useGetFolderQueryFacade(uid);

  if (result.isLoading) {
    return <Skeleton width={50} />;
  }

  if (result.data) {
    return <ParentText folder={result.data.title} />;
  }

  return null;
}
