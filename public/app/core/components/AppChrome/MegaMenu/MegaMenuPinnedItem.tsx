import { css, cx } from '@emotion/css';
import { type DraggableProvided } from '@hello-pangea/dnd';

import { type GrafanaTheme2, type NavModelItem, toIconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, IconButton, Link, Tooltip, useStyles2 } from '@grafana/ui';

import { getDragHandleStyles } from './styles';
import { type PinnedLine } from './utils';

interface Props {
  /** The single breadcrumb line to render. Whole-section pins (Starred) go through MegaMenuItem. */
  line: PinnedLine;
  activeItem?: NavModelItem;
  editMode?: boolean;
  onUnpin: () => void;
  onClick?: () => void;
  /** When set (edit mode), makes the entry draggable and shows a drag handle. */
  draggableProvided?: DraggableProvided;
  /** Disable the unpin control (e.g. while a save is in flight) so edits can't be made and lost. */
  disabled?: boolean;
}

/**
 * A normal pinned entry, rendered as a compact horizontal breadcrumb ("… › Parent › Item") with the
 * top-level parent's icon leading. The leaf (the pinned item) always stays visible; the ancestor
 * crumbs truncate first. Whole-section pins (Starred) are rendered by MegaMenuItem instead.
 */
export function MegaMenuPinnedItem({
  line,
  activeItem,
  editMode,
  onUnpin,
  onClick,
  draggableProvided,
  disabled,
}: Props) {
  const styles = useStyles2(getStyles);
  const dragStyles = useStyles2(getDragHandleStyles);
  const { item, ancestors, icon } = line;
  const label = item.text;

  // Highlight the row whenever it points at the current route, but only claim aria-current when this
  // pinned copy is the canonical active item. getActiveItem resolves the nav copy first, so an item
  // that's both pinned and still in the nav keeps aria-current on its nav row; without this guard
  // both links would carry aria-current="page" for the same route.
  const isActiveRoute = Boolean(item.url) && item.url === activeItem?.url;
  const isCurrentPage = item === activeItem;
  const nearestAncestor = ancestors.at(-1);
  const fullPath = [...ancestors, item.text].join(' › ');
  const LinkComponent = item.url && !item.target && item.url.startsWith('/') ? Link : 'a';

  return (
    <li ref={draggableProvided?.innerRef} className={styles.entry} {...draggableProvided?.draggableProps}>
      <div className={styles.row}>
        {draggableProvided && (
          // Every pinned row is draggable, so the handle owns the reserved column outright.
          <div
            className={cx(dragStyles.column, dragStyles.handle)}
            {...draggableProvided.dragHandleProps}
            aria-label={t('navigation.megamenu-item.reorder-aria-label', 'Reorder {{itemName}}', { itemName: label })}
          >
            <Icon name="draggabledots" size="md" />
          </div>
        )}
        <Tooltip content={fullPath} placement="top">
          <LinkComponent
            href={item.url ?? ''}
            target={item.target}
            onClick={() => {
              item.onClick?.();
              onClick?.();
            }}
            className={cx(styles.link, isActiveRoute && styles.active)}
            {...(isCurrentPage && { 'aria-current': 'page' })}
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
        {editMode && (
          <>
            {/* Centre the unpin in a fixed slot matching the Starred section's control slot so the
                unpin icons line up exactly, then reserve the trailing chevron column the nav rows have. */}
            <span className={styles.unpinSlot}>
              <IconButton
                name="gf-pin-filled"
                onClick={onUnpin}
                aria-pressed
                disabled={disabled}
                tooltip={t('navigation.item.unpin.tooltip', 'Unpin {{itemName}}', { itemName: label })}
              />
            </span>
            <span className={styles.trailingSpacer} />
          </>
        )}
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
    borderRadius: theme.shape.radius.default,
    display: 'flex',
    gap: theme.spacing(1),
    height: theme.spacing(4),
    minWidth: 0,
    '&:hover': {
      backgroundColor: theme.colors.action.hover,
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
    // Matches MegaMenuItem's labelWrapper inset so breadcrumb icons line up with the Starred section.
    paddingLeft: theme.spacing(0.5),
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  leafIcon: css({
    flexShrink: 0,
    width: theme.spacing(3),
  }),
  // Fixed slot that centres the unpin control, matching the Starred section's control slot width.
  unpinSlot: css({
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    justifyContent: 'center',
    width: theme.spacing(3),
  }),
  // Reserves the chevron column the Starred section has after its unpin, so the breadcrumb rows'
  // unpin icon lines up with the Starred section's (which keeps its collapse chevron on the right).
  trailingSpacer: css({
    flexShrink: 0,
    width: theme.spacing(2),
  }),
  // The nearest-ancestor crumb shrinks/ellipsizes first so the leaf label stays visible.
  crumb: css({
    color: theme.colors.text.secondary,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  // The pinned item itself never shrinks so it stays readable (secondary, like the rest of the row).
  leaf: css({
    color: theme.colors.text.secondary,
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
