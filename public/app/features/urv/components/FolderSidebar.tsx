import { css, cx } from '@emotion/css';
import { type ReactNode, useState } from 'react';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FilterInput, Icon, IconButton, Spinner, useStyles2 } from '@grafana/ui';

import { type FolderNode, type useFolderSidebar } from '../hooks/useFolderSidebar';
import { TEAM_FOLDER_ICON } from '../hooks/useTeamFolders';
import { ALL_FOLDERS, NO_FOLDER, ROOT_LEVEL } from '../hooks/useUrvState';

interface Props {
  sidebar: ReturnType<typeof useFolderSidebar>;
  filter: string;
  onFilterChange: (value: string) => void;
  selected?: string;
  onSelect: (folder: string | undefined) => void;
  onNewFolder: () => void;
  onCollapse: () => void;
}

export function FolderSidebar({ sidebar, filter, onFilterChange, selected, onSelect, onNewFolder, onCollapse }: Props) {
  const styles = useStyles2(getStyles);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [teamFoldersOpen, setTeamFoldersOpen] = useState(true);
  const {
    children,
    expanded,
    toggle,
    counts,
    hasSubfolders,
    totals,
    matches,
    parentTitles,
    teamFolders,
    teamFolderUids,
    teamFoldersError,
  } = sidebar;

  const sectionToggle = (label: string, isOpen: boolean, onToggle: () => void) => (
    <button type="button" className={styles.sectionToggle} aria-expanded={isOpen} onClick={onToggle}>
      <Icon name={isOpen ? 'angle-down' : 'angle-right'} size="sm" />
      {label}
    </button>
  );

  const row = (options: {
    key: string;
    depth: number;
    icon: IconName;
    label: ReactNode;
    subtitle?: string;
    count?: number;
    isSelected: boolean;
    onClick: () => void;
    expander?: ReactNode;
    italic?: boolean;
  }) => (
    <div key={options.key} className={cx(styles.row, options.isSelected && styles.selected)}>
      <span className={styles.expander} style={{ marginLeft: options.depth * 12 }}>
        {options.expander}
      </span>
      <button
        type="button"
        className={cx(styles.rowButton, options.italic && styles.italic)}
        onClick={options.onClick}
        aria-current={options.isSelected ? 'true' : undefined}
      >
        <Icon name={options.icon} size="sm" className={styles.rowIcon} />
        <span className={styles.rowText}>
          <span className={styles.ellipsis}>{options.label}</span>
          {options.subtitle && <span className={cx(styles.ellipsis, styles.subtitle)}>{options.subtitle}</span>}
        </span>
        {options.count !== undefined && <span className={styles.count}>{options.count.toLocaleString()}</span>}
      </button>
    </div>
  );

  const folderRow = (node: FolderNode, depth: number, subtitle?: string) => {
    const isOpen = expanded.has(node.uid);
    return row({
      key: node.uid,
      depth,
      icon: teamFolderUids.has(node.uid) ? TEAM_FOLDER_ICON : isOpen ? 'folder-open' : 'folder',
      label: node.title,
      subtitle,
      count: counts[node.uid],
      isSelected: selected === node.uid,
      onClick: () => onSelect(selected === node.uid ? undefined : node.uid),
      expander:
        subtitle === undefined && hasSubfolders[node.uid] ? (
          <IconButton
            name={isOpen ? 'angle-down' : 'angle-right'}
            size="sm"
            aria-label={
              isOpen
                ? t('urv.sidebar.collapse-folder', 'Collapse {{title}}', {
                    title: node.title,
                    interpolation: { escapeValue: false },
                  })
                : t('urv.sidebar.expand-folder', 'Expand {{title}}', {
                    title: node.title,
                    interpolation: { escapeValue: false },
                  })
            }
            onClick={() => toggle(node.uid)}
          />
        ) : undefined,
    });
  };

  const renderLevel = (parentUid: string, depth: number): ReactNode => {
    const nodes = children[parentUid];
    if (!nodes) {
      return (
        <div className={styles.loading} style={{ paddingLeft: 24 + depth * 12 }}>
          <Spinner size="sm" />
        </div>
      );
    }
    return nodes.map((node) => (
      <div key={node.uid}>
        {folderRow(node, depth)}
        {expanded.has(node.uid) && renderLevel(node.uid, depth + 1)}
      </div>
    ));
  };

  return (
    <aside className={styles.sidebar} aria-label={t('urv.sidebar.label', 'Folders')}>
      <div className={styles.header}>
        <span className={styles.heading}>{t('urv.sidebar.title', 'Folders')}</span>
        <span>
          <IconButton name="plus" size="sm" tooltip={t('urv.sidebar.new-folder', 'New folder')} onClick={onNewFolder} />
          <IconButton
            name="angle-double-left"
            size="sm"
            tooltip={t('urv.sidebar.hide', 'Hide folders')}
            onClick={onCollapse}
          />
        </span>
      </div>
      <FilterInput
        value={filter}
        onChange={onFilterChange}
        escapeRegex={false}
        placeholder={t('urv.sidebar.filter', 'Filter folders')}
        className={styles.filter}
      />

      {row({
        key: 'all',
        depth: 0,
        icon: 'layer-group',
        label: t('urv.sidebar.all', 'All resources'),
        count: totals.all,
        isSelected: !selected,
        onClick: () => onSelect(undefined),
      })}
      {row({
        key: 'root',
        depth: 0,
        icon: 'home-alt',
        label: t('urv.sidebar.root', 'Root level'),
        count: totals.root,
        isSelected: selected === ROOT_LEVEL,
        onClick: () => onSelect(selected === ROOT_LEVEL ? undefined : ROOT_LEVEL),
      })}

      {(teamFolders.length > 0 || teamFoldersError) && (
        <>
          {sectionToggle(t('urv.sidebar.team-folders', 'Team folders'), teamFoldersOpen, () =>
            setTeamFoldersOpen((open) => !open)
          )}
          {teamFoldersOpen &&
            (teamFoldersError ? (
              <div className={styles.empty}>{t('urv.sidebar.team-folders-error', "Couldn't load team folders")}</div>
            ) : (
              teamFolders.map((node) => folderRow(node, 0, node.teams.join(', ')))
            ))}
        </>
      )}

      {sectionToggle(t('urv.sidebar.your-folders', 'Your folders'), foldersOpen, () => setFoldersOpen((open) => !open))}
      {foldersOpen &&
        (matches ? (
          matches.length === 0 ? (
            <div className={styles.empty}>{t('urv.sidebar.no-matches', 'No folders match')}</div>
          ) : (
            matches.map((node) => folderRow(node, 0, parentTitles[node.parentUid] ?? ''))
          )
        ) : (
          renderLevel('', 0)
        ))}

      {row({
        key: 'none',
        depth: 0,
        icon: 'folder',
        label: t('urv.sidebar.no-folder', 'No folder'),
        count: totals.noFolder,
        isSelected: selected === NO_FOLDER,
        onClick: () => onSelect(selected === NO_FOLDER ? undefined : NO_FOLDER),
        italic: true,
      })}

      <button
        type="button"
        className={cx(styles.browse, selected === ALL_FOLDERS && styles.selected)}
        onClick={() => onSelect(selected === ALL_FOLDERS ? undefined : ALL_FOLDERS)}
        aria-current={selected === ALL_FOLDERS ? 'true' : undefined}
      >
        {t('urv.sidebar.browse', 'Browse all folders')}
        <span className={styles.browseEnd}>
          {totals.folders !== undefined && <span className={styles.count}>{totals.folders.toLocaleString()}</span>}
          <Icon name="angle-right" size="sm" />
        </span>
      </button>
    </aside>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  sidebar: css({
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(0, 0.5, 0.5, 0.5),
  }),
  heading: css({
    color: theme.colors.text.secondary,
  }),
  filter: css({
    marginBottom: theme.spacing(1),
  }),
  row: css({
    display: 'flex',
    alignItems: 'center',
    minHeight: 30,
    borderRadius: theme.shape.radius.default,
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  selected: css({
    background: theme.colors.action.selected,
    '&:hover': {
      background: theme.colors.action.selected,
    },
  }),
  expander: css({
    display: 'inline-flex',
    justifyContent: 'center',
    width: 20,
    flexShrink: 0,
  }),
  rowButton: css({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    minWidth: 0,
    padding: theme.spacing(0.5, 1, 0.5, 0.25),
    border: 'none',
    background: 'none',
    color: theme.colors.text.primary,
    font: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
  }),
  italic: css({
    fontStyle: 'italic',
  }),
  rowIcon: css({
    flexShrink: 0,
    color: theme.colors.text.secondary,
  }),
  rowText: css({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  }),
  subtitle: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.xs,
  }),
  ellipsis: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  count: css({
    color: theme.colors.text.secondary,
    fontVariantNumeric: 'tabular-nums',
  }),
  sectionToggle: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    margin: theme.spacing(1, 0, 0.5),
    padding: theme.spacing(0, 0.5),
    border: 'none',
    background: 'none',
    color: theme.colors.text.secondary,
    font: 'inherit',
    cursor: 'pointer',
  }),
  loading: css({
    padding: theme.spacing(0.5),
  }),
  empty: css({
    padding: theme.spacing(0.5, 1, 0.5, 3),
    color: theme.colors.text.secondary,
  }),
  browse: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 30,
    marginTop: theme.spacing(1),
    padding: theme.spacing(0.5, 1, 0.5, 2.5),
    border: 'none',
    borderRadius: theme.shape.radius.default,
    background: 'none',
    color: theme.colors.text.link,
    font: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
    '&:hover': {
      textDecoration: 'underline',
    },
  }),
  browseEnd: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  }),
});
