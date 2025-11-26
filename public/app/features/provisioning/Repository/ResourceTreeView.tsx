import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { FilterInput, Icon, LinkButton, Spinner, Stack, useStyles2 } from '@grafana/ui';
import {
  Repository,
  useGetRepositoryFilesQuery,
  useGetRepositoryResourcesQuery,
} from 'app/api/clients/provisioning/v0alpha1';

import { PROVISIONING_URL } from '../constants';
import { FlatTreeItem } from '../types';
import { buildTree, filterTree, flattenTree, getIconName, mergeFilesAndResources } from '../utils/treeUtils';

interface ResourceTreeViewProps {
  repo: Repository;
}

export function ResourceTreeView({ repo }: ResourceTreeViewProps) {
  const styles = useStyles2(getStyles);
  const name = repo.metadata?.name ?? '';

  const filesQuery = useGetRepositoryFilesQuery({ name });
  const resourcesQuery = useGetRepositoryResourcesQuery({ name });

  const [searchQuery, setSearchQuery] = useState('');

  const isLoading = filesQuery.isLoading || resourcesQuery.isLoading;

  // Build tree from merged data
  const flatItems = useMemo(() => {
    const files = filesQuery.data?.items ?? [];
    const resources = resourcesQuery.data?.items ?? [];

    const merged = mergeFilesAndResources(files, resources);
    let tree = buildTree(merged);

    // Apply search filter
    if (searchQuery) {
      tree = filterTree(tree, searchQuery);
    }

    return flattenTree(tree);
  }, [filesQuery.data?.items, resourcesQuery.data?.items, searchQuery]);

  if (isLoading) {
    return (
      <Stack justifyContent="center" alignItems="center">
        <Spinner />
      </Stack>
    );
  }

  return (
    <Stack grow={1} direction="column" gap={2}>
      <Stack gap={2}>
        <FilterInput
          placeholder={t('provisioning.resource-tree.search-placeholder', 'Search by path or title')}
          autoFocus={true}
          value={searchQuery}
          onChange={setSearchQuery}
        />
      </Stack>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.titleHeader}>
                <Trans i18nKey="provisioning.resource-tree.header-title">Title</Trans>
              </th>
              <th className={styles.typeHeader}>
                <Trans i18nKey="provisioning.resource-tree.header-type">Type</Trans>
              </th>
              <th className={styles.hashHeader}>
                <Trans i18nKey="provisioning.resource-tree.header-hash">Hash</Trans>
              </th>
              <th className={styles.actionsHeader}></th>
            </tr>
          </thead>
          <tbody>
            {flatItems.length === 0 ? (
              <tr>
                <td colSpan={4} className={styles.emptyState}>
                  <Trans i18nKey="provisioning.resource-tree.no-items">No items found</Trans>
                </td>
              </tr>
            ) : (
              flatItems.map((flatItem) => <TreeRow key={flatItem.item.path} flatItem={flatItem} repoName={name} />)
            )}
          </tbody>
        </table>
      </div>
    </Stack>
  );
}

interface TreeRowProps {
  flatItem: FlatTreeItem;
  repoName: string;
}

function TreeRow({ flatItem, repoName }: TreeRowProps) {
  const styles = useStyles2(getStyles);
  const { item, level } = flatItem;

  // Determine link based on type
  const getItemLink = () => {
    if (item.type === 'Dashboard' && item.resourceName) {
      return `/d/${item.resourceName}`;
    }
    if (item.type === 'Folder' && item.resourceName) {
      return `/dashboards/f/${item.resourceName}`;
    }
    return undefined;
  };

  const getViewLink = () => {
    if (item.type === 'Dashboard' && item.resourceName) {
      return `/d/${item.resourceName}`;
    }
    if (item.type === 'Folder' && item.resourceName) {
      return `/dashboards/f/${item.resourceName}`;
    }
    // For files, link to file view
    if (item.type === 'File') {
      return `${PROVISIONING_URL}/${repoName}/file/${item.path}`;
    }
    return undefined;
  };

  const titleLink = getItemLink();
  const viewLink = getViewLink();
  const iconName = getIconName(item.type);

  return (
    <tr className={styles.row}>
      <td className={styles.titleCell}>
        <div className={styles.titleContent} style={{ paddingLeft: `${level * 24}px` }}>
          <Icon name={iconName} className={styles.icon} />
          {titleLink ? (
            <a href={titleLink} className={styles.titleLink}>
              {item.title}
            </a>
          ) : (
            <span>{item.title}</span>
          )}
        </div>
      </td>
      <td className={styles.typeCell}>{item.type}</td>
      <td className={styles.hashCell}>{item.hash ? item.hash.substring(0, 7) : ''}</td>
      <td className={styles.actionsCell}>
        {viewLink && (
          <LinkButton href={viewLink} size="sm" variant="secondary">
            <Trans i18nKey="provisioning.resource-tree.view">View</Trans>
          </LinkButton>
        )}
      </td>
    </tr>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  tableWrapper: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
  }),
  table: css({
    width: '100%',
    borderCollapse: 'collapse',
  }),
  titleHeader: css({
    textAlign: 'left',
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    backgroundColor: theme.colors.background.secondary,
  }),
  typeHeader: css({
    textAlign: 'left',
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    backgroundColor: theme.colors.background.secondary,
    width: '120px',
  }),
  hashHeader: css({
    textAlign: 'left',
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    backgroundColor: theme.colors.background.secondary,
    width: '100px',
  }),
  actionsHeader: css({
    textAlign: 'right',
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    backgroundColor: theme.colors.background.secondary,
    width: '100px',
  }),
  row: css({
    '&:hover': {
      backgroundColor: theme.colors.action.hover,
    },
  }),
  titleCell: css({
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  titleContent: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  icon: css({
    color: theme.colors.text.secondary,
    flexShrink: 0,
  }),
  titleLink: css({
    color: theme.colors.text.link,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  }),
  typeCell: css({
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    color: theme.colors.text.secondary,
  }),
  hashCell: css({
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
  actionsCell: css({
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    textAlign: 'right',
  }),
  emptyState: css({
    padding: theme.spacing(4),
    textAlign: 'center',
    color: theme.colors.text.secondary,
  }),
});
