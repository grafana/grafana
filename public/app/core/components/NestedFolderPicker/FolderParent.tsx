import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2 } from '@grafana/data';
import { Text, useStyles2 } from '@grafana/ui';

import { useGetFolderQueryFacade } from '../../../api/clients/folder/v1beta1/hooks';
import { DashboardsTreeItem } from '../../../features/browse-dashboards/types';

interface ParentTextProps {
  folder: string;
}

function ParentText({ folder }: ParentTextProps) {
  const styles = useStyles2(getStyles);
  return (
    <span className={styles.parentText}>
      <Text variant={'bodySmall'} color={'secondary'} truncate>
        /{folder}
      </Text>
    </span>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  parentText: css({
    marginLeft: theme.spacing(1),
  }),
});

export function FolderParent({ item }: { item: DashboardsTreeItem }) {
  if (item.item.kind !== 'folder') {
    return null;
  }

  if (item.item.parentTitle) {
    return <ParentText folder={item.item.parentTitle} />;
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
    return <ParentText folder={result.data.title} />;
  }

  return null;
}
