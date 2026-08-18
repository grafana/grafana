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
  /** Opens the column's filter popup, anchored to the passed element. */
  onOpenFilter: (anchor: HTMLButtonElement | null) => void;
}

/**
 * The `table.refresh` per-column "..." menu. Hidden until the header cell is hovered or something
 * inside it takes focus.
 *
 * Built on Dropdown + Menu so it matches the dashboard panel menu. The filter popup itself is owned
 * by `HeaderCell`, which also opens it from the persistent filter icon.
 */
export function HeaderCellMenu({ displayName, filterable, onOpenFilter }: HeaderCellMenuProps) {
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
            label={t('grafana-ui.table.column-menu-filter', 'Filter values')}
            icon="filter"
            testId={selectors.components.Panels.Visualization.TableNG.headerColumnMenu.filterItem}
            onClick={() => onOpenFilter(wrapperRef.current?.querySelector('button') ?? null)}
          />
        )}
      </Menu>
    ),
    [filterable, menuLabel, onOpenFilter]
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
  // Revealed on hover, but only faded rather than removed from the layout: the button must stay
  // tabbable while transparent so keyboard users can reach it, and auto column widths reserve its
  // space unconditionally (see HEADER_MENU_SPACE) because it never leaves the flow. An active filter
  // is reported by a persistent icon in HeaderCell rather than by pinning this button visible.
  //
  // Scoped to `.table-ng-header-cell`, HeaderCell's own per-column root, rather than the bare
  // `.rdg-cell` react-data-grid puts on every header cell: in a nested table, a column's header
  // cell is also a descendant of the *outer* grid's nested-frame `.rdg-cell`, and `:hover`/
  // `:focus-within` bubble up to that ancestor too. Matching on bare `.rdg-cell` would then reveal
  // every column's menu in the nested table at once, since they're all descendants of that same
  // outer cell.
  button: css({
    label: 'headerColumnMenuButton',
    color: theme.colors.text.secondary,
    opacity: 0,
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create('opacity', { duration: theme.transitions.duration.shorter }),
    },
    '.table-ng-header-cell:hover &, .table-ng-header-cell:focus-within &, &:focus-visible': {
      opacity: 1,
    },
  }),
}));
