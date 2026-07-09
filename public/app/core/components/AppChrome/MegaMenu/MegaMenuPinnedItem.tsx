import { css, cx } from '@emotion/css';
import { type DraggableProvided } from '@hello-pangea/dnd';
import { useLocalStorage } from 'react-use';

import { type GrafanaTheme2, type NavModelItem, toIconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, IconButton, Link, Tooltip, useStyles2 } from '@grafana/ui';

import { type PinnedEntry } from './utils';

interface Props {
  entry: PinnedEntry;
  activeItem?: NavModelItem;
  editMode?: boolean;
  onUnpin: () => void;
  onClick?: () => void;
  /** When set (edit mode), makes the entry draggable and shows a drag handle. */
  draggableProvided?: DraggableProvided;
}

/**
 * A single pinned entry in the pinned box. A normal pin renders as a compact horizontal breadcrumb
 * ("… › Parent › Item") — the leaf (pinned item) always stays visible while the ancestor crumbs
 * truncate first. A whole-section pin (Starred) renders as a collapsible section listing its
 * children. The entry maps to one pinned url, with a single unpin control and drag handle.
 */
export function MegaMenuPinnedItem({ entry, activeItem, editMode, onUnpin, onClick, draggableProvided }: Props) {
  const styles = useStyles2(getStyles);
  const { section } = entry;
  // Expand state is only used for section pins; the hook is still called unconditionally.
  const [expanded, setExpanded] = useLocalStorage(
    `grafana.navigation.expanded[pinned/${section?.text ?? entry.url}]`,
    true
  );

  const label = section ? section.text : entry.lines[0].item.text;
  const isActiveUrl = (item: NavModelItem) => Boolean(item.url) && item.url === activeItem?.url;
  const handleClick = (item: NavModelItem) => () => {
    item.onClick?.();
    onClick?.();
  };
  const iconFor = (item: NavModelItem) => (item.icon ? (toIconName(item.icon) ?? 'apps') : 'apps');
  const linkComponentFor = (item: NavModelItem) => (item.url && !item.target && item.url.startsWith('/') ? Link : 'a');

  const unpinButton = editMode && (
    <IconButton
      name="gf-unpin"
      variant="destructive"
      onClick={onUnpin}
      aria-pressed
      tooltip={t('navigation.item.unpin.tooltip', 'Unpin {{itemName}}', { itemName: label })}
    />
  );

  const dragHandle = draggableProvided && (
    <div
      className={styles.dragHandle}
      {...draggableProvided.dragHandleProps}
      aria-label={t('navigation.megamenu-item.reorder-aria-label', 'Reorder {{itemName}}', { itemName: label })}
    >
      <Icon name="draggabledots" size="lg" />
    </div>
  );

  const renderBreadcrumb = (line: PinnedEntry['lines'][number]) => {
    const { item, ancestors, icon } = line;
    const nearestAncestor = ancestors.at(-1);
    const fullPath = [...ancestors, item.text].join(' › ');
    const LinkComponent = linkComponentFor(item);

    return (
      <Tooltip content={fullPath} placement="top">
        <LinkComponent
          href={item.url ?? ''}
          target={item.target}
          onClick={handleClick(item)}
          className={cx(styles.link, isActiveUrl(item) && styles.active)}
          {...(isActiveUrl(item) && { 'aria-current': 'page' })}
        >
          {/* The leading icon is the top-level parent section's icon, not the leaf's own. */}
          <Icon className={styles.leafIcon} name={icon ? (toIconName(icon) ?? 'apps') : 'apps'} size="lg" />
          {ancestors.length > 1 && <span className={styles.fixed}>…</span>}
          {nearestAncestor && (
            <>
              <span className={styles.crumb}>{nearestAncestor}</span>
              <Icon className={styles.sep} name="angle-right" size="sm" />
            </>
          )}
          <span className={styles.leaf}>{item.text}</span>
        </LinkComponent>
      </Tooltip>
    );
  };

  // Whole-section pin (Starred): a collapsible section header with its children listed underneath.
  if (section) {
    const SectionLink = linkComponentFor(section);
    const children = (section.children ?? []).filter((child) => !child.isCreateAction);

    return (
      <li ref={draggableProvided?.innerRef} className={styles.entry} {...draggableProvided?.draggableProps}>
        <div className={styles.row}>
          <SectionLink
            href={section.url ?? ''}
            target={section.target}
            onClick={handleClick(section)}
            className={cx(styles.link, isActiveUrl(section) && styles.active)}
            {...(isActiveUrl(section) && { 'aria-current': 'page' })}
          >
            <Icon className={styles.leafIcon} name={iconFor(section)} size="lg" />
            <span className={styles.leaf}>{section.text}</span>
          </SectionLink>
          <IconButton
            name={expanded ? 'angle-up' : 'angle-down'}
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
            aria-label={
              expanded
                ? t('navigation.megamenu-item.collapse-aria-label', 'Collapse section: {{sectionName}}', {
                    sectionName: section.text,
                  })
                : t('navigation.megamenu-item.expand-aria-label', 'Expand section: {{sectionName}}', {
                    sectionName: section.text,
                  })
            }
          />
          {unpinButton}
          {dragHandle}
        </div>
        {expanded && (
          <ul className={styles.children}>
            {children.map((child) => {
              const ChildLink = linkComponentFor(child);
              return (
                <li key={child.id ?? child.url} className={styles.childRow}>
                  <ChildLink
                    href={child.url ?? ''}
                    target={child.target}
                    onClick={handleClick(child)}
                    className={cx(styles.link, styles.childLink, isActiveUrl(child) && styles.active)}
                    {...(isActiveUrl(child) && { 'aria-current': 'page' })}
                  >
                    {/* Children sit under the section header (like the nav), so no leading icon. */}
                    <span className={styles.leaf}>{child.text}</span>
                  </ChildLink>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li ref={draggableProvided?.innerRef} className={styles.entry} {...draggableProvided?.draggableProps}>
      <div className={styles.row}>
        {renderBreadcrumb(entry.lines[0])}
        {unpinButton}
        {dragHandle}
      </div>
    </li>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  entry: css({
    listStyleType: 'none',
  }),
  row: css({
    alignItems: 'center',
    display: 'flex',
    gap: theme.spacing(1),
    height: theme.spacing(4),
    minWidth: 0,
  }),
  dragHandle: css({
    alignItems: 'center',
    color: theme.colors.text.secondary,
    cursor: 'grab',
    display: 'flex',
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  link: css({
    alignItems: 'center',
    color: theme.colors.text.secondary,
    display: 'flex',
    flex: 1,
    gap: theme.spacing(0.5),
    minWidth: 0,
    overflow: 'hidden',
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  children: css({
    display: 'flex',
    flexDirection: 'column',
    listStyleType: 'none',
    margin: 0,
    padding: 0,
  }),
  childRow: css({
    display: 'flex',
    height: theme.spacing(4),
  }),
  // Indent the section's children so they sit under the section label, past the icon column.
  childLink: css({
    paddingLeft: theme.spacing(3),
  }),
  leafIcon: css({
    flexShrink: 0,
    width: theme.spacing(3),
  }),
  // The nearest-ancestor crumb shrinks/ellipsizes first so the leaf label stays visible.
  crumb: css({
    color: theme.colors.text.secondary,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  // The pinned item itself: brighter than the crumbs and never shrinks, so it stays readable.
  leaf: css({
    color: theme.colors.text.primary,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  }),
  // The leading "…" and the "›" separator never shrink.
  fixed: css({
    color: theme.colors.text.secondary,
    flexShrink: 0,
  }),
  sep: css({
    color: theme.colors.text.disabled,
    flexShrink: 0,
  }),
  active: css({
    color: theme.colors.text.primary,
  }),
});
