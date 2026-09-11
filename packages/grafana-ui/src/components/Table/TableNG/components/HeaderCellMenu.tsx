import { css } from '@emotion/css';
import memoize from 'micro-memoize';
import { useCallback, useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Dropdown } from '../../../Dropdown/Dropdown';
import { IconButton } from '../../../IconButton/IconButton';
import { Menu } from '../../../Menu/Menu';

interface HeaderCellMenuProps {
  displayName: string;
  filterable: boolean;
  /** Whether this column currently has an active filter — swaps the menu item's label to reflect it. */
  hasActiveFilter?: boolean;
  /** Opens the column's filter popup, anchored to the passed element. */
  onOpenFilter: (anchor: HTMLButtonElement | null) => void;
  /** `table.refresh`: hides this column. Omitted when hiding isn't available. */
  onHideColumn?: () => void;
  /** `table.refresh`: whether hiding this column is currently allowed. */
  canHideColumn?: boolean;
  /** `table.refresh`: whether this column is currently pinned. */
  isPinned?: boolean;
  /** `table.refresh`: pins/unpins this column. Omitted when pinning isn't available. */
  onTogglePin?: () => void;
  /**
   * `table.refresh`: opens the column-visibility sidebar. Omitted when none of reorder/hide/pin are
   * available for this table — there'd be nothing in the sidebar to manage.
   */
  onOpenColumnPanel?: () => void;
}

/**
 * The `table.refresh` per-column "..." menu. Hidden until the header cell is hovered, the button
 * itself takes keyboard focus, or its own menu is open.
 *
 * Built on Dropdown + Menu so it matches the dashboard panel menu. The filter popup itself is owned
 * by `HeaderCell`, which also opens it from the persistent filter icon.
 */
export function HeaderCellMenu({
  displayName,
  filterable,
  hasActiveFilter,
  onOpenFilter,
  onHideColumn,
  canHideColumn,
  isPinned,
  onTogglePin,
  onOpenColumnPanel,
}: HeaderCellMenuProps) {
  // `Dropdown` overwrites its child's ref with its own floating-ui reference, so we can't hold a ref
  // on the button directly. We reach it through the wrapper instead, so the popup can anchor to it.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const styles = useStyles2(getStyles);

  const menuLabel = t('grafana-ui.table.column-menu-label', 'Column options for {{name}}', { name: displayName });

  const overlay = useCallback(
    () => (
      <Menu ariaLabel={menuLabel}>
        {filterable && (
          <Menu.Item
            label={
              hasActiveFilter
                ? t('grafana-ui.table.column-menu-update-filter', 'Update filter')
                : t('grafana-ui.table.column-menu-filter', 'Filter values')
            }
            icon="filter"
            testId={selectors.components.Panels.Visualization.TableNG.headerColumnMenu.filterItem}
            onClick={() => onOpenFilter(wrapperRef.current?.querySelector('button') ?? null)}
          />
        )}
        {onTogglePin && (
          <Menu.Item
            label={
              isPinned
                ? t('grafana-ui.table.column-menu-unpin', 'Unpin column')
                : t('grafana-ui.table.column-menu-pin', 'Pin column left')
            }
            icon="gf-pin"
            testId={selectors.components.Panels.Visualization.TableNG.headerColumnMenu.pinItem}
            onClick={onTogglePin}
          />
        )}
        {onHideColumn && (
          <Menu.Item
            label={t('grafana-ui.table.column-menu-hide', 'Hide column')}
            icon="eye-slash"
            disabled={!canHideColumn}
            testId={selectors.components.Panels.Visualization.TableNG.headerColumnMenu.hideItem}
            onClick={onHideColumn}
          />
        )}
        {onOpenColumnPanel && (
          <>
            {(filterable || onTogglePin || onHideColumn) && <Menu.Divider />}
            <Menu.Item
              label={t('grafana-ui.table.column-menu-manage-columns', 'Manage columns')}
              icon="columns"
              testId={selectors.components.Panels.Visualization.TableNG.headerColumnMenu.manageColumnsItem}
              onClick={onOpenColumnPanel}
            />
          </>
        )}
      </Menu>
    ),
    [
      filterable,
      hasActiveFilter,
      menuLabel,
      onOpenFilter,
      onTogglePin,
      isPinned,
      onHideColumn,
      canHideColumn,
      onOpenColumnPanel,
    ]
  );

  return (
    // The IconButton owns keyboard interaction. This wrapper only keeps its pointer events from
    // reaching react-data-grid's header sort handler.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      ref={wrapperRef}
      className={styles.wrapper}
      onClick={(ev) => ev.stopPropagation()}
      onMouseDown={(ev) => ev.stopPropagation()}
    >
      <Dropdown overlay={overlay} placement="bottom-end">
        <IconButton
          className={styles.button}
          name="ellipsis-v"
          size="sm"
          aria-label={menuLabel}
          data-testid={selectors.components.Panels.Visualization.TableNG.headerColumnMenu.button}
        />
      </Dropdown>
    </div>
  );
}

const getStyles = memoize((theme: GrafanaTheme2) => ({
  wrapper: css({
    label: 'headerColumnMenuWrapper',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  }),
  // Faded not unmounted on hover: stays tabbable, and auto column widths always reserve its space
  // (see HEADER_MENU_SPACE). Active filter shown via a persistent icon in HeaderCell instead.
  //
  // Keyed on the button's own `:focus-visible`, not the cell's `:focus-within`: rdg moves DOM focus
  // into the header cell on plain grid navigation, so `:focus-within` fired with no real intent.
  // `aria-expanded` (from Dropdown) keeps it visible while its dropdown is open.
  button: css({
    label: 'headerColumnMenuButton',
    color: theme.colors.text.secondary,
    opacity: 0,
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create('opacity', { duration: theme.transitions.duration.shorter }),
    },
    // Scoped to `.table-ng-header-cell` (HeaderCell's own root), not bare `.rdg-cell`: in a nested
    // table, a column's header cell also sits inside the outer grid's `.rdg-cell`, so `:hover` on
    // bare `.rdg-cell` would reveal every column's menu in the nested table at once.
    '.table-ng-header-cell:hover &, &:focus-visible, &[aria-expanded="true"]': {
      opacity: 1,
    },
  }),
}));
