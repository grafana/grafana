import { css } from '@emotion/css';
import { memo } from 'react';
import Skeleton from 'react-loading-skeleton';
import { useAsync } from 'react-use';

import { t } from '@grafana/i18n';
import { Box, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import { useGetCombinedFolderQuery } from '../../../api/clients/folder/v1beta1/hooks';
import { type DashboardsTreeItem } from '../../../features/browse-dashboards/types';
import { type DashboardViewItem } from '../../../features/search/types';

import { getFolderPath } from './utils';

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

interface FolderParentProps {
  item: DashboardsTreeItem;
  /** Show every visible ancestor of the folder instead of only its immediate parent. */
  showFullPath?: boolean;
}

export const FolderParent = memo(function FolderParent({ item, showFullPath = false }: FolderParentProps) {
  if (item.item.kind !== 'folder') {
    return null;
  }

  if (showFullPath) {
    return <FullFolderPath folder={item.item} treeParentUID={item.parentUID} />;
  }

  return <ImmediateFolderParent folder={item.item} treeParentUID={item.parentUID} />;
});

interface FolderParentLookupProps {
  folder: DashboardViewItem;
  /** Parent of the row in the tree, used when the folder itself carries no parent. */
  treeParentUID?: string;
}

function ImmediateFolderParent({ folder, treeParentUID }: FolderParentLookupProps) {
  if (folder.parentTitle) {
    return <ParentText folder={folder.parentTitle} />;
  }

  const parentUID = folder.parentUID || treeParentUID;

  if (parentUID) {
    return <NetworkFolderParent uid={parentUID} />;
  }

  return null;
}

function NetworkFolderParent({ uid }: { uid: string }) {
  const result = useGetCombinedFolderQuery(uid);

  if (result.isLoading) {
    return <Skeleton width={50} />;
  }

  if (result.data) {
    return <ParentText folder={result.data.title} />;
  }

  return null;
}

function FullFolderPath({ folder, treeParentUID }: FolderParentLookupProps) {
  const styles = useStyles2(getStyles);
  const { value: folderIndex, loading } = useAsync(() => getGrafanaSearcher().getFolderPaths(), []);

  if (loading) {
    return <Skeleton width={50} />;
  }

  const path = folderIndex ? getFolderPath(folderIndex, folder.uid) : undefined;
  if (!path?.titles.length) {
    // Root-level folder or one missing from the folder index
    return <ImmediateFolderParent folder={folder} treeParentUID={treeParentUID} />;
  }

  const fullPath = `/${path.titles.join('/')}`;
  const tooltip = path.hasUnknownAncestor
    ? `${fullPath}\n${t(
        'browse-dashboards.folder-picker.unknown-folder-tooltip',
        'You may not have access to one or more of the parent folders.'
      )}`
    : fullPath;

  return (
    <Box marginLeft={1} minWidth={0}>
      <Tooltip content={<span className={styles.tooltip}>{tooltip}</span>} placement="bottom-start">
        {/* rtl puts the ellipsis on the left, so the immediate parent stays visible */}
        <div className={styles.path}>
          <bdi>
            <Text variant={'bodySmall'} color={'secondary'}>
              {fullPath}
            </Text>
          </bdi>
        </div>
      </Tooltip>
    </Box>
  );
}

const getStyles = () => ({
  path: css({
    direction: 'rtl',
    textAlign: 'left',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  tooltip: css({
    whiteSpace: 'pre-line',
  }),
});
