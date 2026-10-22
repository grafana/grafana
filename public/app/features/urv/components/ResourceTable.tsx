import { css, cx } from '@emotion/css';

import { type GrafanaTheme2, dateTimeFormatTimeAgo } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Checkbox, Icon, IconButton, Link, Text, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { useStarItem } from 'app/features/stars/hooks';

import { openPath, starTarget } from '../actions';
import { FIELD, type ResultItem } from '../api/globalSearchApi';
import { type ManagerLookup } from '../hooks/useManagerLookup';
import { type UrvSort } from '../hooks/useUrvState';
import { getKindInfo } from '../kinds';

import { KindIcon } from './KindIcon';
import { ManagerBadge } from './ManagerBadge';
import { RowActions } from './RowActions';

export function itemKey(item: ResultItem): string {
  const { group, resource, name } = item.resource;
  return `${group}/${resource}/${name}`;
}

export function itemTitle(item: ResultItem): string {
  const title = item.fields?.[FIELD.title];
  return typeof title === 'string' && title ? title : item.resource.name;
}

export function stringField(item: ResultItem, field: string): string {
  const value = item.fields?.[field];
  return typeof value === 'string' ? value : '';
}

function numberField(item: ResultItem, field: string): number | undefined {
  const value = item.fields?.[field];
  return typeof value === 'number' ? value : undefined;
}

export interface RowHandlers {
  folderTitles: Record<string, string>;
  ownerName: (createdBy: string) => string;
  manager: ManagerLookup;
  starredKeys: Set<string>;
  /** The folder being browsed, if any. */
  currentFolder?: string;
  /** Anything on the page is selected, so selection controls stay visible. */
  hasSelection: boolean;
  isSelected: (item: ResultItem) => boolean;
  onToggleSelected: (item: ResultItem) => void;
  onOpenFolder: (folderUID: string) => void;
  onChanged: () => void;
  onDeleted: (item: ResultItem) => void;
}

interface Props extends RowHandlers {
  items: ResultItem[];
  /** Mixed lists show each row's type, since there's no group header to say it. */
  showType: boolean;
  sort: UrvSort;
  onSort: (sort: UrvSort) => void;
}

export function ResourceTable({ items, showType, sort, onSort, ...handlers }: Props) {
  const styles = useStyles2(getStyles);
  const sortHeader = (label: string, value: UrvSort) => (
    <button type="button" className={styles.sortHeader} onClick={() => onSort(value)}>
      {label}
      {sort === value && <Icon name={value === 'title' ? 'arrow-up' : 'arrow-down'} size="sm" />}
    </button>
  );

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.checkCell} />
          <th>{sortHeader(t('urv.table.name', 'Name'), 'title')}</th>
          <th className={styles.location}>{t('urv.table.location', 'Location')}</th>
          <th className={styles.owner}>{t('urv.table.owner', 'Owner')}</th>
          <th className={styles.updated}>{sortHeader(t('urv.table.updated', 'Updated'), 'updated')}</th>
          <th className={styles.iconCell} />
          <th className={styles.iconCell} />
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <ResourceRow key={itemKey(item)} item={item} showType={showType} {...handlers} />
        ))}
      </tbody>
    </table>
  );
}

function ResourceRow({
  item,
  showType,
  folderTitles,
  ownerName,
  manager: lookupManager,
  starredKeys,
  isSelected,
  onToggleSelected,
  onOpenFolder,
  onChanged,
  onDeleted,
}: RowHandlers & { item: ResultItem; showType: boolean }) {
  const styles = useStyles2(getStyles);
  const info = getKindInfo(item.resource);
  const manager = lookupManager(item);
  const title = itemTitle(item);
  const path = openPath(item.resource);
  const star = starTarget(item.resource);
  const toggleStar = useStarItem(star?.group ?? '', star?.kind ?? '');
  const isStarred = star ? starredKeys.has(`${star.group}/${star.kind}/${item.resource.name}`) : false;
  const folder = stringField(item, FIELD.folder);
  // The index stores 0 for objects that were never edited.
  const updated = numberField(item, FIELD.updated) || numberField(item, FIELD.created);
  const selected = isSelected(item);

  return (
    <tr className={cx(selected && styles.selectedRow)}>
      <td className={styles.checkCell}>
        <Checkbox
          value={selected}
          onChange={() => onToggleSelected(item)}
          aria-label={t('urv.table.select', 'Select {{title}}', { title, interpolation: { escapeValue: false } })}
        />
      </td>
      <td>
        <span className={styles.name}>
          {showType && <KindIcon info={info} size="sm" />}
          {path ? (
            <Link href={path} className={styles.nameLink} title={title}>
              {title}
            </Link>
          ) : (
            <span className={styles.nameText} title={title}>
              {title}
            </span>
          )}
          <ManagerBadge manager={manager} />
        </span>
      </td>
      <td className={styles.location}>
        {!info.supportsFolders ? (
          <Text color="secondary">-</Text>
        ) : folder ? (
          <button type="button" className={styles.folderButton} onClick={() => onOpenFolder(folder)}>
            <Icon name="folder" size="sm" />
            <span className={styles.ellipsis}>{folderTitles[folder] ?? folder}</span>
          </button>
        ) : (
          <span className={styles.noFolder}>
            <Icon name="folder" size="sm" />
            {t('urv.table.no-folder', 'No folder')}
          </span>
        )}
      </td>
      <td className={styles.owner}>
        <span className={styles.ellipsis}>{ownerName(stringField(item, FIELD.createdBy))}</span>
      </td>
      <td className={styles.updated}>{updated ? dateTimeFormatTimeAgo(updated) : ''}</td>
      <td className={styles.iconCell}>
        {star && contextSrv.isSignedIn && (
          <IconButton
            name={isStarred ? 'favorite' : 'star'}
            className={cx(isStarred && styles.starred)}
            aria-label={isStarred ? t('urv.table.unstar', 'Unstar') : t('urv.table.star', 'Star')}
            onClick={() => toggleStar({ id: item.resource.name, title }, !isStarred)}
          />
        )}
      </td>
      <td className={styles.iconCell}>
        <RowActions
          item={item}
          title={title}
          moveLockedReason={manager.moveLockedReason}
          deleteLockedReason={manager.deleteLockedReason}
          onMoved={onChanged}
          onDeleted={() => onDeleted(item)}
        />
      </td>
    </tr>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  table: css({
    width: '100%',
    tableLayout: 'fixed',
    borderCollapse: 'collapse',
    fontSize: theme.typography.bodySmall.fontSize,
    'th, td': {
      padding: theme.spacing(0.75, 1),
      textAlign: 'left',
      verticalAlign: 'middle',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    },
    th: {
      color: theme.colors.text.secondary,
      fontWeight: theme.typography.fontWeightMedium,
    },
    'tbody tr:last-child td': {
      borderBottom: 'none',
    },
    'tbody tr:hover': {
      background: theme.colors.action.hover,
    },
  }),
  selectedRow: css({
    background: theme.colors.action.selected,
  }),
  checkCell: css({ width: 36 }),
  iconCell: css({ width: 36, textAlign: 'center' }),
  location: css({ width: '22%' }),
  owner: css({ width: '16%' }),
  updated: css({ width: 120, color: theme.colors.text.secondary, whiteSpace: 'nowrap' }),
  sortHeader: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: 0,
    border: 'none',
    background: 'none',
    color: 'inherit',
    font: 'inherit',
    cursor: 'pointer',
  }),
  name: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    minWidth: 0,
  }),
  nameLink: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: theme.colors.text.primary,
    '&:hover': {
      textDecoration: 'underline',
    },
  }),
  nameText: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  folderButton: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    maxWidth: '100%',
    padding: 0,
    border: 'none',
    background: 'none',
    color: theme.colors.text.secondary,
    font: 'inherit',
    cursor: 'pointer',
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  noFolder: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
  }),
  ellipsis: css({
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  starred: css({
    color: theme.colors.warning.text,
  }),
});
