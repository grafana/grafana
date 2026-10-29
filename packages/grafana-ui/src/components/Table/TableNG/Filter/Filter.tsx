import { css } from '@emotion/css';
import { clsx } from 'clsx';
import memoize from 'micro-memoize';
import { memo, useRef } from 'react';

import { type Field, type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Icon } from '../../../Icon/Icon';
import { Popover } from '../../../Tooltip/Popover';
import { useTableFilters } from '../TableFilterContext';
import { type TableRow } from '../types';
import { getDisplayName } from '../utils';

import { FilterPopup } from './FilterPopup';
import { useFilterPopupState } from './useFilterPopupState';

interface Props {
  name: string;
  rows: TableRow[];
  field?: Field;
  timeZone?: string;
  iconClassName?: string;
  parentIndex?: number;
  /** Cross-filter rows keyed by filter key. Each entry holds the rows available *before* that filter was applied.  */
  crossFilterRows: Record<string, () => TableRow[]>;
  /** Rows surviving all active filters. Used for brand-new (not-yet-active) filter popups. */
  crossFilterTailRows: TableRow[];
}

export const Filter = memo(
  ({ name, field, timeZone, iconClassName, parentIndex, crossFilterRows, crossFilterTailRows }: Props) => {
    const ref = useRef<HTMLButtonElement>(null);
    const filteringDisabled = useTableFilters()?.filteringDisabled;
    const styles = useStyles2(getStyles);
    const { isPopoverVisible, setPopoverVisible, filterEnabled, popupProps } = useFilterPopupState({
      name,
      field,
      timeZone,
      parentIndex,
      crossFilterRows,
      crossFilterTailRows,
    });

    return (
      <button
        className={styles.headerFilter}
        ref={ref}
        type="button"
        disabled={filteringDisabled}
        aria-haspopup="dialog"
        aria-expanded={isPopoverVisible}
        aria-label={t('grafana-ui.table.filter.button', `Filter {{name}}`, {
          name: field ? getDisplayName(field) : '',
          interpolation: { escapeValue: false },
        })}
        data-testid={selectors.components.Panels.Visualization.TableNG.Filters.HeaderButton}
        tabIndex={0}
        onKeyDown={(ev) => {
          // can't use tabindex alone to handle this, because column sort would intercept the keypress.
          if (ev.target === ref.current && (ev.key === 'Enter' || ev.key === ' ')) {
            setPopoverVisible(true);
            ev.stopPropagation();
            ev.preventDefault();
          }
        }}
        onClick={(ev) => {
          ev.stopPropagation();
          if (!isPopoverVisible) {
            setPopoverVisible(true);
          }
        }}
      >
        <Icon name="filter" className={clsx(iconClassName, filterEnabled ? styles.filterIconEnabled : '')} />
        {isPopoverVisible && ref.current && (
          <Popover
            content={<FilterPopup {...popupProps} buttonElement={ref.current} />}
            placement="bottom-start"
            referenceElement={ref.current}
            show
          />
        )}
      </button>
    );
  }
);

Filter.displayName = 'Filter';

const getStyles = memoize((theme: GrafanaTheme2) => ({
  headerFilter: css({
    background: 'transparent',
    border: 'none',
    label: 'headerFilter',
    padding: 0,
    alignSelf: 'flex-end',
    borderRadius: theme.spacing(0.25),
  }),
  filterIconEnabled: css({
    label: 'filterIconEnabled',
    color: theme.colors.primary.text,
  }),
}));
