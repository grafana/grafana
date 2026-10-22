import { css } from '@emotion/css';
import { type ReactNode, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Icon, IconButton, Text, useStyles2 } from '@grafana/ui';

import { type FolderNode } from '../hooks/useFolderSidebar';
import { TEAM_FOLDER_ICON } from '../hooks/useTeamFolders';

interface Props {
  folders: FolderNode[];
  /** Matches folder titles. A match's parents stay in view so it keeps its place in the tree. */
  filter: string;
  teamFolderUids: Set<string>;
  truncated: boolean;
  onOpenFolder: (uid: string) => void;
}

export function FolderTree({ folders, filter, teamFolderUids, truncated, onOpenFolder }: Props) {
  const styles = useStyles2(getStyles);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const children = useMemo(() => childrenByParent(folders), [folders]);
  const visible = useMemo(() => matchesWithParents(folders, filter), [folders, filter]);
  const filtering = visible !== undefined;

  const toggle = (uid: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });

  const renderLevel = (parentUid: string, depth: number): ReactNode =>
    (children[parentUid] ?? [])
      .filter((node) => !visible || visible.has(node.uid))
      .map((node) => {
        const hasChildren = Boolean(children[node.uid]?.length);
        // Every match stays in view while filtering, so collapsing is off then.
        const isOpen = hasChildren && (filtering || !collapsed.has(node.uid));
        return (
          <li key={node.uid}>
            <div className={styles.row} style={{ paddingLeft: depth * 20 }}>
              <span className={styles.expander}>
                {hasChildren && !filtering && (
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
                )}
              </span>
              <button type="button" className={styles.open} onClick={() => onOpenFolder(node.uid)}>
                <Icon
                  name={teamFolderUids.has(node.uid) ? TEAM_FOLDER_ICON : isOpen ? 'folder-open' : 'folder'}
                  className={styles.icon}
                />
                <span className={styles.title}>{node.title}</span>
              </button>
            </div>
            {isOpen && <ul className={styles.list}>{renderLevel(node.uid, depth + 1)}</ul>}
          </li>
        );
      });

  const isEmpty = filtering ? visible.size === 0 : folders.length === 0;

  return (
    <section className={styles.card} aria-label={t('urv.tree.label', 'All folders')}>
      {!filtering && !isEmpty && (
        <header className={styles.header}>
          <Button size="sm" variant="secondary" fill="text" icon="angle-down" onClick={() => setCollapsed(new Set())}>
            {t('urv.tree.expand-all', 'Expand all')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            fill="text"
            icon="angle-right"
            onClick={() => setCollapsed(new Set(Object.keys(children)))}
          >
            {t('urv.tree.collapse-all', 'Collapse all')}
          </Button>
        </header>
      )}
      {isEmpty ? (
        <div className={styles.empty}>
          <Text color="secondary">
            {filtering ? t('urv.tree.no-matches', 'No folders match') : t('urv.tree.empty', 'No folders yet')}
          </Text>
        </div>
      ) : (
        <ul className={styles.root}>{renderLevel('', 0)}</ul>
      )}
      {truncated && (
        <footer className={styles.footer}>
          <Text variant="bodySmall" color="secondary">
            {t('urv.tree.truncated', '', {
              count: folders.length,
              total: folders.length.toLocaleString(),
              defaultValue_one: 'Showing the first {{total}} folder',
              defaultValue_other: 'Showing the first {{total}} folders',
            })}
          </Text>
        </footer>
      )}
    </section>
  );
}

function childrenByParent(folders: FolderNode[]): Record<string, FolderNode[]> {
  const known = new Set(folders.map((folder) => folder.uid));
  const byParent: Record<string, FolderNode[]> = {};
  for (const folder of folders) {
    // A folder whose parent the user can't see would be unreachable, so it goes at the top.
    const parent = known.has(folder.parentUid) ? folder.parentUid : '';
    if (!byParent[parent]) {
      byParent[parent] = [];
    }
    byParent[parent].push(folder);
  }
  return byParent;
}

/** Undefined when there's no filter. */
function matchesWithParents(folders: FolderNode[], filter: string): Set<string> | undefined {
  const needle = filter.trim().toLowerCase();
  if (!needle) {
    return undefined;
  }
  const byUid = new Map(folders.map((folder) => [folder.uid, folder]));
  const visible = new Set<string>();
  for (const folder of folders) {
    if (!folder.title.toLowerCase().includes(needle)) {
      continue;
    }
    let current: FolderNode | undefined = folder;
    while (current && !visible.has(current.uid)) {
      visible.add(current.uid);
      current = byUid.get(current.parentUid);
    }
  }
  return visible;
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
    justifyContent: 'flex-end',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5, 1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.secondary,
  }),
  root: css({
    margin: 0,
    padding: theme.spacing(1),
    listStyle: 'none',
  }),
  list: css({
    margin: 0,
    padding: 0,
    listStyle: 'none',
  }),
  row: css({
    display: 'flex',
    alignItems: 'center',
    minHeight: 32,
    borderRadius: theme.shape.radius.default,
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  expander: css({
    display: 'inline-flex',
    justifyContent: 'center',
    width: 24,
    flexShrink: 0,
  }),
  open: css({
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
  icon: css({
    flexShrink: 0,
    color: theme.colors.text.secondary,
  }),
  title: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  empty: css({
    padding: theme.spacing(2),
  }),
  footer: css({
    padding: theme.spacing(1, 1.5),
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
});
