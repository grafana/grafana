import { css, cx } from '@emotion/css';
import { type ReactNode, useCallback, useEffect, useId, useState } from 'react';

import { type GrafanaTheme2, type IconName, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dropdown, Icon, Link, Menu, Spinner, Text, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

export interface SectionSidebarGroupProps {
  /** Matches the provider id */
  id: string;
  title?: ReactNode;
  children: ReactNode;
}

/** Separates blocks of groups, matching the mega menu divider */
export function SectionSidebarDivider() {
  const styles = useStyles2(getStyles);
  return <hr className={styles.divider} />;
}

/** A titled block of rows in the sidebar body */
export function SectionSidebarGroup({ id, title, children }: SectionSidebarGroupProps) {
  const styles = useStyles2(getStyles);
  const headingId = useId();

  return (
    <section className={styles.group} data-section-sidebar-group={id} aria-labelledby={title ? headingId : undefined}>
      {title && (
        <div className={styles.groupTitle} id={headingId}>
          <Text color="secondary" truncate>
            {title}
          </Text>
        </div>
      )}
      <ul className={styles.list}>{children}</ul>
    </section>
  );
}

export interface SectionSidebarItemProps {
  title: string;
  icon?: IconName;
  url?: string;
  subtitle?: string;
  active?: boolean;
  level?: number;
  /** Renders a chevron and makes the row toggle its children */
  expandable?: boolean;
  expanded?: boolean;
  loading?: boolean;
  onToggle?: () => void;
  onClick?: () => void;
  children?: ReactNode;
}

/**
 * A single row. Expandable rows with a url expand from the chevron and navigate from the title;
 * expandable rows without a url toggle from anywhere on the row.
 */
export function SectionSidebarItem({
  title,
  icon,
  url,
  subtitle,
  active,
  level = 0,
  expandable,
  expanded,
  loading,
  onToggle,
  onClick,
  children,
}: SectionSidebarItemProps) {
  const styles = useStyles2(getStyles);
  const indent = { paddingLeft: `calc(${level} * 16px + 8px)` };
  const toggleLabel = expanded
    ? t('section-sidebar.item.collapse', 'Collapse {{title}}', { title, interpolation: { escapeValue: false } })
    : t('section-sidebar.item.expand', 'Expand {{title}}', { title, interpolation: { escapeValue: false } });

  const content = (
    <>
      {icon && <Icon name={icon} className={styles.icon} />}
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </span>
      {loading && <Spinner inline size="sm" />}
    </>
  );

  const chevron = expandable && (
    <Icon name={expanded ? 'angle-down' : 'angle-right'} className={styles.chevron} aria-hidden />
  );

  let row: ReactNode;
  if (expandable && !url) {
    row = (
      <button
        type="button"
        className={cx(styles.row, styles.button)}
        style={indent}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        {/* Same inner spacing as link rows, so icons and labels line up across every row */}
        <span className={styles.link}>{content}</span>
        <span className={styles.chevronSlot}>{chevron}</span>
      </button>
    );
  } else {
    row = (
      <div className={cx(styles.row, active && styles.active)} style={indent}>
        {url ? (
          <Link href={url} className={styles.link} onClick={onClick} aria-current={active ? 'page' : undefined}>
            {content}
          </Link>
        ) : (
          <span className={styles.link}>{content}</span>
        )}
        {expandable && (
          <button
            type="button"
            className={styles.chevronButton}
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={toggleLabel}
          >
            {chevron}
          </button>
        )}
      </div>
    );
  }

  return (
    <li className={styles.item}>
      {row}
      {expandable && expanded && children && <ul className={styles.list}>{children}</ul>}
    </li>
  );
}

export interface SectionSidebarMenuRowProps {
  title: string;
  icon?: IconName;
  items: Array<{ id: string; label: string; icon?: IconName; url?: string }>;
}

/** A row that opens a menu of further links, e.g. a section's less used pages under "More" */
export function SectionSidebarMenuRow({ title, icon, items }: SectionSidebarMenuRowProps) {
  const styles = useStyles2(getStyles);

  if (items.length === 0) {
    return null;
  }

  const menu = (
    <Menu>
      {items.map((item) => (
        <Menu.Item key={item.id} label={item.label} icon={item.icon} url={item.url} />
      ))}
    </Menu>
  );

  return (
    <li className={styles.item}>
      <Dropdown overlay={menu} placement="bottom-start">
        <button type="button" className={cx(styles.row, styles.button)} style={{ paddingLeft: '8px' }}>
          <span className={styles.link}>
            {icon && <Icon name={icon} className={styles.icon} />}
            <span className={styles.text}>
              <span className={styles.title}>{title}</span>
            </span>
          </span>
        </button>
      </Dropdown>
    </li>
  );
}

const EXPANDED_STORAGE_PREFIX = 'grafana.sectionSidebar.expanded.';

/**
 * Expanded state for a sidebar row, kept in local storage under `key` so it survives
 * navigation and reloads. Without a key it is plain component state.
 */
export function useSectionSidebarExpanded(
  key: string | undefined | false,
  defaultExpanded = false
): [boolean, (expanded: boolean) => void] {
  const storageKey = key ? `${EXPANDED_STORAGE_PREFIX}${key}` : undefined;
  const [expanded, setExpanded] = useState(() =>
    storageKey ? store.getBool(storageKey, defaultExpanded) : defaultExpanded
  );

  const update = useCallback(
    (next: boolean) => {
      setExpanded(next);
      if (storageKey) {
        store.set(storageKey, next);
      }
    },
    [storageKey]
  );

  return [expanded, update];
}

export interface SectionSidebarTreeNode {
  id: string;
  title: string;
  url?: string;
  icon?: IconName;
  hasChildren?: boolean;
}

export interface SectionSidebarTreeProps<T extends SectionSidebarTreeNode> {
  /** Children of the tree root; `loadChildren` fetches deeper levels on expand */
  nodes: T[];
  loadChildren: (node: T) => Promise<T[]>;
  activeId?: string;
  level?: number;
  /** Remembers which nodes are expanded under this key; without it, expansion resets on reload */
  persistKey?: string;
}

/** A lazily loaded tree of rows */
export function SectionSidebarTree<T extends SectionSidebarTreeNode>({
  nodes,
  loadChildren,
  activeId,
  level = 0,
  persistKey,
}: SectionSidebarTreeProps<T>) {
  return (
    <>
      {nodes.map((node) => (
        <SectionSidebarTreeRow
          key={node.id}
          node={node}
          loadChildren={loadChildren}
          activeId={activeId}
          level={level}
          persistKey={persistKey}
        />
      ))}
    </>
  );
}

function SectionSidebarTreeRow<T extends SectionSidebarTreeNode>({
  node,
  loadChildren,
  activeId,
  level,
  persistKey,
}: {
  node: T;
  loadChildren: (node: T) => Promise<T[]>;
  activeId?: string;
  level: number;
  persistKey?: string;
}) {
  const [expanded, setExpanded] = useSectionSidebarExpanded(persistKey && `${persistKey}.${node.id}`);
  const [children, setChildren] = useState<T[]>();
  const [loading, setLoading] = useState(false);

  // Loads children on expand, including a row remembered as expanded from a previous visit
  useEffect(() => {
    if (!expanded || children) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadChildren(node)
      .then((loaded) => !cancelled && setChildren(loaded))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to expansion
  }, [expanded]);

  const onToggle = () => setExpanded(!expanded);

  return (
    <SectionSidebarItem
      title={node.title}
      icon={node.icon}
      // Nodes with children only expand and collapse; leaves navigate
      url={node.hasChildren ? undefined : node.url}
      level={level}
      active={node.id === activeId}
      expandable={node.hasChildren}
      expanded={expanded}
      loading={loading}
      onToggle={onToggle}
    >
      {children && children.length > 0 && (
        <SectionSidebarTree
          nodes={children}
          loadChildren={loadChildren}
          activeId={activeId}
          level={level + 1}
          persistKey={persistKey}
        />
      )}
      {children && children.length === 0 && <SectionSidebarEmptyRow level={level + 1} />}
    </SectionSidebarItem>
  );
}

function SectionSidebarEmptyRow({ level }: { level: number }) {
  const styles = useStyles2(getStyles);
  return (
    <li className={styles.item}>
      <div className={cx(styles.row, styles.empty)} style={{ paddingLeft: `calc(${level} * 16px + 8px)` }}>
        {t('section-sidebar.tree.empty', 'No items')}
      </div>
    </li>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  divider: css({
    background: `linear-gradient(90deg, transparent 0%, ${theme.colors.border.weak} 20%, ${theme.colors.border.weak} 80%, transparent 100%)`,
    border: 'none',
    flexShrink: 0,
    height: 1,
    margin: theme.spacing(0, 0, 1, 0),
  }),
  group: css({
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: theme.spacing(1),
  }),
  groupTitle: css({
    padding: theme.spacing(1, 1, 0.5, 1),
  }),
  list: css({
    listStyle: 'none',
    margin: 0,
    padding: 0,
  }),
  item: css({
    margin: 0,
  }),
  row: css({
    alignItems: 'center',
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    display: 'flex',
    gap: theme.spacing(0.5),
    minHeight: theme.spacing(4),
    paddingRight: theme.spacing(0.5),
    width: '100%',
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  button: css({
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    '&:focus-visible': getFocusStyles(theme),
  }),
  active: css({
    background: theme.colors.action.selected,
    '&:hover': {
      background: theme.colors.action.selected,
    },
  }),
  link: css({
    alignItems: 'center',
    color: 'inherit',
    display: 'flex',
    flex: 1,
    gap: theme.spacing(1.5),
    minWidth: 0,
    padding: theme.spacing(0.5, 0),
    '&:focus-visible': getFocusStyles(theme),
  }),
  icon: css({
    color: theme.colors.text.secondary,
    flexShrink: 0,
  }),
  text: css({
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    minWidth: 0,
  }),
  title: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  subtitle: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  chevron: css({
    color: theme.colors.text.secondary,
    flexShrink: 0,
  }),
  chevronSlot: css({
    alignItems: 'center',
    display: 'flex',
    padding: theme.spacing(0.5),
  }),
  chevronButton: css({
    alignItems: 'center',
    background: 'none',
    border: 'none',
    borderRadius: theme.shape.radius.default,
    display: 'flex',
    padding: theme.spacing(0.5),
    '&:hover': {
      background: theme.colors.action.hover,
    },
    '&:focus-visible': getFocusStyles(theme),
  }),
  empty: css({
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
    '&:hover': {
      background: 'none',
    },
  }),
});
