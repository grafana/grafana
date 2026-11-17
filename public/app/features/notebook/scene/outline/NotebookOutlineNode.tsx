import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { Icon, Text, useStyles2 } from '@grafana/ui';

import { type NotebookOutlineNode as OutlineTreeNode } from './buildNotebookOutline';

export interface OutlineSearch {
  matchingIds: Set<string>;
  /** The matches and every ancestor of one, so a match is never hidden under a collapsed heading. */
  visibleIds: Set<string>;
}

interface Props {
  id: string;
  label: string;
  icon: IconName;
  childNodes: OutlineTreeNode[];
  /** Whether the node can hold children at all, which is what shows its caret and "(empty)". */
  isContainer: boolean;
  depth: number;
  /** Survives the pane closing, so reopening it keeps what the reader expanded. */
  collapsedState: Map<string, boolean>;
  search?: OutlineSearch;
  onSelect: (id: string) => void;
}

/**
 * One row of the notebook outline and its subtree. Mirrors DashboardOutlineNode's markup and styles
 * so both outlines read as the same component; that one is bound to dashboard editable elements, so
 * it cannot render notebook entries itself.
 */
export function NotebookOutlineNode({
  id,
  label,
  icon,
  childNodes,
  isContainer,
  depth,
  collapsedState,
  search,
  onSelect,
}: Props) {
  const styles = useStyles2(getStyles);
  // Same default as the dashboard outline: only the root starts expanded.
  const [isCollapsed, setIsCollapsed] = useState(() => collapsedState.get(id) ?? depth > 0);

  const isSearching = search !== undefined;
  const isSearchMatch = isSearching && search.matchingIds.has(id);
  const visibleChildren = isSearching
    ? childNodes.filter((child) => search.visibleIds.has(child.entry.id))
    : childNodes;
  const effectiveCollapsed = isSearching ? false : isCollapsed;

  const onToggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    collapsedState.set(id, next);
  };

  return (
    <li
      role="treeitem"
      aria-selected={false}
      aria-expanded={isContainer && visibleChildren.length > 0 ? !effectiveCollapsed : undefined}
      className={styles.wrapper}
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      style={{ '--depth': depth } as React.CSSProperties}
    >
      <div className={cx(styles.row, isSearchMatch && styles.searchMatch)}>
        <div className={styles.indentation}></div>
        {isContainer && !isSearching && (
          <button
            className={styles.angleButton}
            onClick={onToggleCollapse}
            aria-label={
              isCollapsed
                ? t('notebook.outline.tree-item.expand', 'Expand {{label}}', { label })
                : t('notebook.outline.tree-item.collapse', 'Collapse {{label}}', { label })
            }
          >
            <Icon name={isCollapsed ? 'angle-right' : 'angle-down'} />
          </button>
        )}
        <button
          className={styles.nodeButton}
          onClick={() => onSelect(id)}
          data-testid={selectors.pages.Notebooks.Item.outlineEntry}
        >
          <Icon size="sm" name={icon} />
          <div className={styles.nodeName}>
            <Text truncate>{label}</Text>
          </div>
        </button>
      </div>

      {isContainer && !effectiveCollapsed && (visibleChildren.length > 0 || !isSearching) && (
        <ul className={styles.nodeChildren} role="group">
          {visibleChildren.length > 0 ? (
            visibleChildren.map((child) => (
              <NotebookOutlineNode
                key={child.entry.id}
                id={child.entry.id}
                label={child.entry.label}
                icon={child.entry.kind === 'panel' ? 'chart-line' : 'text-fields'}
                childNodes={child.children}
                isContainer={child.children.length > 0}
                depth={depth + 1}
                collapsedState={collapsedState}
                search={search}
                onSelect={onSelect}
              />
            ))
          ) : (
            <li
              role="treeitem"
              aria-selected={false}
              className={styles.wrapper}
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              style={{ '--depth': depth + 1 } as React.CSSProperties}
            >
              <div className={styles.row}>
                <div className={styles.indentation}></div>
                <Text color="secondary" italic>
                  <Trans i18nKey="notebook.outline.tree-item.empty">(empty)</Trans>
                </Text>
              </div>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

// Kept in step with DashboardOutlineNode's styles, minus the edit-mode and selection states a notebook
// outline has no use for.
function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      flexGrow: 1,
      flexDirection: 'column',
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.secondary,
    }),
    indentation: css({
      marginLeft: `calc(var(--depth) * ${theme.spacing(3)})`,
    }),
    searchMatch: css({
      color: theme.colors.text.primary,
    }),
    angleButton: css({
      boxShadow: 'none',
      border: 'none',
      background: 'transparent',
      borderRadius: theme.shape.radius.default,
      padding: 0,
      color: 'inherit',
      lineHeight: 0,
    }),
    nodeChildren: css({
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      gap: theme.spacing(0.5),

      // tree line
      '&::before': {
        content: '""',
        position: 'absolute',
        width: '1px',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
        background: theme.colors.border.weak,
        marginLeft: `calc(11px + ${theme.spacing(3)} * var(--depth))`,
      },
    }),
    row: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
    nodeButton: css({
      boxShadow: 'none',
      border: 'none',
      background: 'transparent',
      padding: 0,
      borderRadius: theme.shape.radius.default,
      color: 'inherit',
      display: 'flex',
      flexGrow: 1,
      alignItems: 'center',
      gap: theme.spacing(0.5),
      overflow: 'hidden',
    }),
    nodeName: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      flexGrow: 1,
      alignItems: 'center',
      overflow: 'hidden',
    }),
  };
}
