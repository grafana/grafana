import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  Alert,
  Column,
  FilterInput,
  Icon,
  InteractiveTable,
  LoadingPlaceholder,
  RadioButtonGroup,
  Stack,
  Tag,
  Text,
  useStyles2,
} from '@grafana/ui';
import { type EntityType, type ResourceType, useResourcePermissions } from './useResourcePermissions';
import { type ResolvedResource, useResolveResources, useResourceCounts } from './useResolveResources';

interface Props {
  /** Numeric ID of the entity */
  entityId: number;
  /** Display name for the entity (shown in empty states) */
  entityName?: string;
  /** Type of entity: 'user' or 'service-account' */
  entityType?: EntityType;
}

const RESOURCE_TYPE_OPTIONS = [
  { label: 'All', value: '' as const },
  { label: 'Folders', value: 'folders' as const },
  { label: 'Dashboards', value: 'dashboards' as const },
  { label: 'Datasources', value: 'datasources' as const },
];

interface ResourceRow {
  id: string;
  name: string;
  type: ResourceType;
  accessLevel: string;
  isWildcard: boolean;
  folderName?: string;
  url?: string;
}

const RESOURCE_ICONS: Record<ResourceType, string> = {
  folders: 'folder',
  dashboards: 'apps',
  datasources: 'database',
};

const ACCESS_COLORS: Record<string, 'blue' | 'green' | 'orange' | 'purple'> = {
  View: 'blue',
  Query: 'blue',
  Edit: 'green',
  Admin: 'orange',
};

function toRows(resolved: ResolvedResource[]): ResourceRow[] {
  return resolved.map((r, i) => ({
    id: `${r.permission.type}-${r.permission.uid || r.permission.folderUid || 'wildcard'}-${i}`,
    name: r.name,
    type: r.permission.type,
    accessLevel: r.permission.accessLevel,
    isWildcard: r.permission.isWildcard,
    folderName: r.folderName,
    url: r.url,
  }));
}

export const ResourceAccessPage = ({ entityId, entityType = 'service-account' }: Props) => {
  const styles = useStyles2(getStyles);
  const [typeFilter, setTypeFilter] = useState<ResourceType | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  const { resources, wildcardTypes, isLoading, error } = useResourcePermissions(entityId, entityType);
  const { resolved, isResolving } = useResolveResources(resources, isLoading);
  const wildcardCounts = useResourceCounts(wildcardTypes);

  const allRows = useMemo(() => toRows(resolved), [resolved]);

  // Filter rows
  const rows = useMemo(() => {
    return allRows.filter((r) => {
      // Don't show wildcard entries in the table (they get a banner instead)
      if (r.isWildcard) {
        return false;
      }
      const matchesType = !typeFilter || r.type === typeFilter;
      if (!matchesType) {
        return false;
      }
      if (!searchQuery.trim()) {
        return true;
      }
      const q = searchQuery.toLowerCase();
      return r.name.toLowerCase().includes(q);
    });
  }, [allRows, typeFilter, searchQuery]);

  // Count non-wildcard resources per type
  const typeCounts = useMemo(() => {
    const counts: Record<ResourceType, number> = { dashboards: 0, folders: 0, datasources: 0 };
    for (const r of allRows) {
      if (!r.isWildcard) {
        counts[r.type]++;
      }
    }
    return counts;
  }, [allRows]);

  const columns = useMemo<Array<Column<ResourceRow>>>(() => {
    return [
      {
        id: 'name',
        header: t('serviceaccounts.resource-access.column-name', 'Name'),
        cell: ({ row }) => (
          <Stack direction="row" alignItems="center" gap={1}>
            <Icon name={RESOURCE_ICONS[row.original.type] as 'folder' | 'apps' | 'database'} />
            <Text weight="medium">{row.original.name}</Text>
          </Stack>
        ),
        sortType: 'string',
      },
      {
        id: 'type',
        header: t('serviceaccounts.resource-access.column-type', 'Type'),
        cell: ({ row }) => (
          <Text color="secondary" variant="bodySmall">
            {row.original.type.charAt(0).toUpperCase() + row.original.type.slice(1)}
          </Text>
        ),
        sortType: 'string',
      },
      {
        id: 'accessLevel',
        header: t('serviceaccounts.resource-access.column-access', 'Access'),
        cell: ({ row }) => (
          <Tag
            name={row.original.accessLevel}
            colorIndex={
              ACCESS_COLORS[row.original.accessLevel] === 'blue'
                ? 0
                : ACCESS_COLORS[row.original.accessLevel] === 'green'
                  ? 4
                  : ACCESS_COLORS[row.original.accessLevel] === 'orange'
                    ? 2
                    : 6
            }
          />
        ),
      },
    ];
  }, []);

  if (isLoading || isResolving) {
    return (
      <LoadingPlaceholder
        text={t('serviceaccounts.resource-access.loading', 'Loading resource access...')}
      />
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        title={t('serviceaccounts.resource-access.error-title', 'Failed to load permissions')}
      >
        {error}
      </Alert>
    );
  }

  return (
    <div>
      {/* Summary cards */}
      <Stack direction="row" gap={2} wrap="wrap">
        <SummaryCard
          type="folders"
          count={typeCounts.folders}
          isWildcard={wildcardTypes.has('folders')}
          wildcardCount={wildcardCounts.folders}
        />
        <SummaryCard
          type="dashboards"
          count={typeCounts.dashboards}
          isWildcard={wildcardTypes.has('dashboards')}
          wildcardCount={wildcardCounts.dashboards}
        />
        <SummaryCard
          type="datasources"
          count={typeCounts.datasources}
          isWildcard={wildcardTypes.has('datasources')}
          wildcardCount={wildcardCounts.datasources}
        />
      </Stack>

      {/* Wildcard warnings */}
      {wildcardTypes.size > 0 && (
        <div className={styles.wildcardSection}>
          {wildcardTypes.has('dashboards') && (
            <Alert
              severity="warning"
              title={t(
                'serviceaccounts.resource-access.wildcard-dashboards',
                'This service account has access to ALL dashboards'
              )}
            >
              {t(
                'serviceaccounts.resource-access.wildcard-dashboards-detail',
                'Granted via wildcard permission. {{count}} dashboards currently in this org.',
                { count: wildcardCounts.dashboards ?? '...' }
              )}
            </Alert>
          )}
          {wildcardTypes.has('folders') && (
            <Alert
              severity="warning"
              title={t(
                'serviceaccounts.resource-access.wildcard-folders',
                'This service account has access to ALL folders'
              )}
            >
              {t(
                'serviceaccounts.resource-access.wildcard-folders-detail',
                'Granted via wildcard permission. {{count}} folders currently in this org.',
                { count: wildcardCounts.folders ?? '...' }
              )}
            </Alert>
          )}
          {wildcardTypes.has('datasources') && (
            <Alert
              severity="warning"
              title={t(
                'serviceaccounts.resource-access.wildcard-datasources',
                'This service account has access to ALL datasources'
              )}
            >
              {t(
                'serviceaccounts.resource-access.wildcard-datasources-detail',
                'Granted via wildcard permission. {{count}} datasources currently in this org.',
                { count: wildcardCounts.datasources ?? '...' }
              )}
            </Alert>
          )}
        </div>
      )}

      {/* Filter controls */}
      <div className={styles.tableHeader}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" alignItems="center" gap={2}>
            <Text color="secondary" variant="bodySmall">
              {rows.length} {rows.length === 1 ? 'resource' : 'resources'}
              {typeFilter ? ` (${typeFilter})` : ''}
            </Text>
            <RadioButtonGroup
              options={RESOURCE_TYPE_OPTIONS}
              value={typeFilter}
              onChange={(v) => setTypeFilter(v)}
              size="sm"
            />
          </Stack>
          <div className={styles.searchWrapper}>
            <FilterInput
              placeholder={t('serviceaccounts.resource-access.search-placeholder', 'Filter by name...')}
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>
        </Stack>
      </div>

      {/* Resource table */}
      {rows.length > 0 ? (
        <InteractiveTable columns={columns} data={rows} getRowId={(row) => row.id} />
      ) : (
        <div className={styles.emptyState}>
          <Text color="secondary" italic>
            {allRows.filter((r) => !r.isWildcard).length === 0
              ? t(
                  'serviceaccounts.resource-access.no-specific',
                  'No specific resource grants. Access is via wildcard permissions only.'
                )
              : t(
                  'serviceaccounts.resource-access.no-matches',
                  'No resources matching your filters.'
                )}
          </Text>
        </div>
      )}

      {/* Footer note */}
      <div className={styles.footer}>
        <Text color="secondary" variant="bodySmall">
          {t(
            'serviceaccounts.resource-access.footer-note',
            'Folder access also grants access to dashboards within that folder. This view shows direct permission grants only.'
          )}
        </Text>
      </div>
    </div>
  );
};

interface SummaryCardProps {
  type: ResourceType;
  count: number;
  isWildcard: boolean;
  wildcardCount: number | null;
}

const SummaryCard = ({ type, count, isWildcard, wildcardCount }: SummaryCardProps) => {
  const styles = useStyles2(getStyles);
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  const icon = RESOURCE_ICONS[type] as 'folder' | 'apps' | 'database';

  return (
    <div className={isWildcard ? styles.summaryCardWarning : styles.summaryCard}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Icon name={icon} />
        <Text weight="medium">{label}</Text>
      </Stack>
      <Text variant="h3">
        {isWildcard ? (
          <>
            <Icon name="exclamation-triangle" size="sm" /> All ({wildcardCount ?? '...'})
          </>
        ) : (
          count
        )}
      </Text>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  summaryCard: css({
    padding: theme.spacing(2),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    minWidth: 160,
    flex: '1 1 0',
  }),
  summaryCardWarning: css({
    padding: theme.spacing(2),
    border: `1px solid ${theme.colors.warning.border}`,
    borderRadius: theme.shape.radius.default,
    backgroundColor: theme.colors.warning.transparent,
    minWidth: 160,
    flex: '1 1 0',
  }),
  wildcardSection: css({
    marginTop: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  tableHeader: css({
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(1),
  }),
  searchWrapper: css({
    maxWidth: 300,
  }),
  emptyState: css({
    padding: theme.spacing(4),
    textAlign: 'center',
  }),
  footer: css({
    marginTop: theme.spacing(2),
    paddingTop: theme.spacing(1),
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
});
