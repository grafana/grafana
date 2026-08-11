import { css } from '@emotion/css';
import memoize from 'micro-memoize';
import { useCallback, useRef } from 'react';

import { type Field, type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Dropdown } from '../../../Dropdown/Dropdown';
import { IconButton } from '../../../IconButton/IconButton';
import { Menu } from '../../../Menu/Menu';
import { Popover } from '../../../Tooltip/Popover';
import { FilterPopup } from '../Filter/FilterPopup';
import { useFilterPopupState } from '../Filter/useFilterPopupState';
import { type FilterType, type TableRow } from '../types';

interface HeaderCellMenuProps {
  name: string;
  displayName: string;
  field: Field;
  filterable: boolean;
  filter: FilterType;
  setFilter: React.Dispatch<React.SetStateAction<FilterType>>;
  parentIndex?: number;
  crossFilterRows: Record<string, TableRow[]>;
  crossFilterTailRows: TableRow[];
}

/**
 * The `table.refresh` per-column "..." menu. Hidden until the header cell is hovered or something
 * inside it takes focus, and pinned visible while the column is filtered so a filtered column stays
 * distinguishable from an unfiltered one.
 *
 * Built on Dropdown + Menu so it matches the dashboard panel menu.
 */
export function HeaderCellMenu({
  name,
  displayName,
  field,
  filterable,
  filter,
  setFilter,
  parentIndex,
  crossFilterRows,
  crossFilterTailRows,
}: HeaderCellMenuProps) {
  // `Dropdown` overwrites its child's ref with its own floating-ui reference, so we can't hold a ref
  // on the button directly. We anchor off the wrapper instead, and reach the button through it for
  // the focus restore `FilterPopup` does on close.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { isPopoverVisible, setPopoverVisible, popupProps } = useFilterPopupState({
    name,
    filter,
    setFilter,
    field,
    parentIndex,
    crossFilterRows,
    crossFilterTailRows,
  });
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
            onClick={() => setPopoverVisible(true)}
          />
        )}
      </Menu>
    ),
    [filterable, menuLabel, setPopoverVisible]
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

      {isPopoverVisible && wrapperRef.current && (
        <Popover
          content={<FilterPopup {...popupProps} buttonElement={wrapperRef.current.querySelector('button')} />}
          // matches the inline filter button's placement: the popup opens rightward from the control
          // rather than back across the column it belongs to
          placement="bottom-start"
          referenceElement={wrapperRef.current}
          show
        />
      )}
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
  button: css({
    label: 'headerColumnMenuButton',
    color: theme.colors.text.secondary,
    opacity: 0,
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create('opacity', { duration: theme.transitions.duration.shorter }),
    },
    '.rdg-cell:hover &, .rdg-cell:focus-within &, &:focus-visible': {
      opacity: 1,
    },
  }),
}));
