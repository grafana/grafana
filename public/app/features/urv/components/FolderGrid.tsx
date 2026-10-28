import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Checkbox, Icon, useStyles2 } from '@grafana/ui';

import { FIELD, type ResultItem } from '../api/globalSearchApi';

import { ManagerBadge } from './ManagerBadge';
import { type RowHandlers, itemKey, itemTitle, stringField } from './ResourceTable';
import { RowActions } from './RowActions';

export type FolderLayout = 'grid' | 'list';

interface Props extends RowHandlers {
  items: ResultItem[];
}

export function FolderGrid({ items, ...handlers }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <ul className={styles.grid}>
      {items.map((item) => (
        <FolderCard key={itemKey(item)} item={item} {...handlers} />
      ))}
    </ul>
  );
}

function FolderCard({
  item,
  folderTitles,
  manager: lookupManager,
  currentFolder,
  hasSelection,
  isSelected,
  onToggleSelected,
  onOpenFolder,
  onChanged,
  onDeleted,
}: RowHandlers & { item: ResultItem }) {
  const styles = useStyles2(getStyles);
  const title = itemTitle(item);
  const manager = lookupManager(item);
  const folder = stringField(item, FIELD.folder);
  // Saying "in <this folder>" while browsing it adds nothing.
  const parent = folder !== currentFolder ? folder : '';
  const selected = isSelected(item);

  return (
    <li className={cx(styles.card, selected && styles.selected, (selected || hasSelection) && styles.selecting)}>
      <span className={styles.lead}>
        <span className={styles.icon}>
          <Icon name="folder" />
        </span>
        <span className={styles.check}>
          <Checkbox
            value={selected}
            onChange={() => onToggleSelected(item)}
            aria-label={t('urv.table.select', 'Select {{title}}', { title, interpolation: { escapeValue: false } })}
          />
        </span>
      </span>
      {/* Browses into the folder here, like a file browser. The menu's Open goes to the folder page. */}
      <button type="button" className={styles.open} onClick={() => onOpenFolder(item.resource.name)} title={title}>
        <span className={styles.title}>{title}</span>
        {parent && (
          <span className={styles.subtitle}>
            {t('urv.folders.in-folder', 'in {{folder}}', {
              folder: folderTitles[parent] ?? parent,
              interpolation: { escapeValue: false },
            })}
          </span>
        )}
      </button>
      <ManagerBadge manager={manager} />
      <RowActions
        item={item}
        title={title}
        moveLockedReason={manager.moveLockedReason}
        deleteLockedReason={manager.deleteLockedReason}
        onMoved={onChanged}
        onDeleted={() => onDeleted(item)}
      />
    </li>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const icon = css({
    display: 'inline-flex',
    color: theme.colors.text.secondary,
  });
  const check = css({
    display: 'none',
  });
  const showCheck = {
    [`.${icon}`]: { display: 'none' },
    [`.${check}`]: { display: 'inline-flex' },
  };

  return {
    grid: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: theme.spacing(1),
      margin: 0,
      padding: theme.spacing(1),
      listStyle: 'none',
    }),
    card: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.75),
      minWidth: 0,
      minHeight: 34,
      padding: theme.spacing(0, 0.25, 0, 1),
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      '&:hover': {
        background: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
        ...showCheck,
      },
      '&:focus-within': showCheck,
    }),
    selecting: css(showCheck),
    selected: css({
      borderColor: theme.colors.primary.border,
      background: theme.colors.primary.transparent,
      '&:hover': {
        background: theme.colors.primary.transparent,
      },
    }),
    lead: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 18,
      flexShrink: 0,
    }),
    icon,
    check,
    open: css({
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      padding: theme.spacing(0.5, 0),
      lineHeight: 1.3,
      border: 'none',
      background: 'none',
      color: theme.colors.text.primary,
      font: 'inherit',
      textAlign: 'left',
      cursor: 'pointer',
    }),
    title: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      fontWeight: theme.typography.fontWeightMedium,
    }),
    subtitle: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.size.xs,
    }),
  };
};
