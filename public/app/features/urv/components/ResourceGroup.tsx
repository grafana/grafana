import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Checkbox, Icon, RadioButtonGroup, Stack, Text, useStyles2 } from '@grafana/ui';

import { FOLDER_GROUP_RESOURCE } from '../api/globalSearchApi';
import { PAGE_SIZE, type ResultGroup } from '../hooks/useGlobalSearch';
import { type UrvSort } from '../hooks/useUrvState';
import { kindInfoFor } from '../kinds';

import { FolderGrid, type FolderLayout } from './FolderGrid';
import { KindIcon } from './KindIcon';
import { ResourceTable, type RowHandlers } from './ResourceTable';

interface Props extends RowHandlers {
  group: ResultGroup;
  sort: UrvSort;
  onSort: (sort: UrvSort) => void;
  onLoadMore: () => void;
  /** Unset when the group already is the whole view. */
  onViewAll?: () => void;
  onSelectAll: (selected: boolean) => void;
  folderLayout: FolderLayout;
  onFolderLayoutChange: (layout: FolderLayout) => void;
}

function shownText(shown: number, total: number, relation: ResultGroup['relation']) {
  return t('urv.group.showing', 'Showing {{shown}} of {{relation}}{{total}}', {
    shown: shown.toLocaleString(),
    total: total.toLocaleString(),
    relation: relation === 'eq' ? '' : '≤ ',
  });
}

export function ResourceGroup({
  group,
  sort,
  onSort,
  onLoadMore,
  onViewAll,
  onSelectAll,
  folderLayout,
  onFolderLayoutChange,
  ...handlers
}: Props) {
  const styles = useStyles2(getStyles);
  const [collapsed, setCollapsed] = useState(false);
  const info = kindInfoFor(group.type);
  const isFolders = group.type === FOLDER_GROUP_RESOURCE;
  const layoutOptions: Array<SelectableValue<FolderLayout>> = [
    {
      value: 'grid',
      icon: 'apps',
      description: t('urv.folders.grid', 'Grid'),
      ariaLabel: t('urv.folders.grid', 'Grid'),
    },
    {
      value: 'list',
      icon: 'list-ul',
      description: t('urv.folders.list', 'List'),
      ariaLabel: t('urv.folders.list', 'List'),
    },
  ];
  const selectedCount = group.items.filter(handlers.isSelected).length;
  const allSelected = group.items.length > 0 && selectedCount === group.items.length;
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <section className={styles.card} aria-label={info.plural()}>
      <header className={styles.header}>
        <Checkbox
          // Checkbox never clears the mixed state on its own, so remount it when that changes.
          key={someSelected ? 'some' : 'all-or-none'}
          value={allSelected}
          indeterminate={someSelected}
          onChange={() => onSelectAll(!allSelected)}
          aria-label={t('urv.group.select-all', 'Select all shown {{type}}', {
            type: info.plural(),
            interpolation: { escapeValue: false },
          })}
        />
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          <Icon name={collapsed ? 'angle-right' : 'angle-down'} />
          <KindIcon info={info} />
          <Text weight="medium">{info.plural()}</Text>
          <span className={styles.count}>{group.total.toLocaleString()}</span>
        </button>
        {isFolders && (
          <div className={styles.headerEnd}>
            <RadioButtonGroup size="sm" options={layoutOptions} value={folderLayout} onChange={onFolderLayoutChange} />
          </div>
        )}
      </header>
      {!collapsed && (
        <>
          {isFolders && folderLayout === 'grid' ? (
            <FolderGrid items={group.items} {...handlers} />
          ) : (
            <ResourceTable items={group.items} showType={false} sort={sort} onSort={onSort} {...handlers} />
          )}
          {(group.continue || onViewAll) && group.total > group.items.length && (
            <footer className={styles.footer}>
              <Text variant="bodySmall" color="secondary">
                {shownText(group.items.length, group.total, group.relation)}
              </Text>
              {group.continue && <ShowMoreButton group={group} onClick={onLoadMore} />}
              {onViewAll && (
                <Button size="sm" variant="secondary" fill="text" onClick={onViewAll}>
                  <Stack alignItems="center" gap={0.5}>
                    {t('urv.group.view-all', 'View all {{total}} {{type}}', {
                      total: group.total.toLocaleString(),
                      type: info.plural().toLowerCase(),
                      interpolation: { escapeValue: false },
                    })}
                    <Icon name="arrow-right" />
                  </Stack>
                </Button>
              )}
            </footer>
          )}
        </>
      )}
    </section>
  );
}

/** One table across every type, for the type tabs and "Group: None". */
export function FlatResults({
  group,
  sort,
  onSort,
  onLoadMore,
  onSelectAll,
  ...handlers
}: Omit<Props, 'onViewAll' | 'folderLayout' | 'onFolderLayoutChange'>) {
  const styles = useStyles2(getStyles);
  return (
    <section className={styles.card}>
      <ResourceTable items={group.items} showType={!group.type} sort={sort} onSort={onSort} {...handlers} />
      {group.total > group.items.length && (
        <footer className={styles.footer}>
          <Text variant="bodySmall" color="secondary">
            {shownText(group.items.length, group.total, group.relation)}
          </Text>
          {group.continue && <ShowMoreButton group={group} onClick={onLoadMore} />}
        </footer>
      )}
    </section>
  );
}

function ShowMoreButton({ group, onClick }: { group: ResultGroup; onClick: () => void }) {
  const remaining = group.relation === 'eq' ? group.total - group.items.length : PAGE_SIZE;
  return (
    <Button size="sm" variant="secondary" onClick={onClick} disabled={group.isLoadingMore}>
      {group.isLoadingMore
        ? t('urv.group.loading', 'Loading...')
        : t('urv.group.show-more', 'Show {{size}} more', { size: Math.max(1, Math.min(PAGE_SIZE, remaining)) })}
    </Button>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.primary,
    overflow: 'hidden',
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.secondary,
  }),
  toggle: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: 0,
    border: 'none',
    background: 'none',
    color: theme.colors.text.primary,
    cursor: 'pointer',
  }),
  headerEnd: css({
    marginLeft: 'auto',
  }),
  count: css({
    padding: theme.spacing(0, 0.75),
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.background.canvas,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontVariantNumeric: 'tabular-nums',
  }),
  footer: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1, 1.5),
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
});
