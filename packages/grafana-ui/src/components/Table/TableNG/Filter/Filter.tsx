import { css } from '@emotion/css';
import { clsx } from 'clsx';
import { memo, useRef, useState } from 'react';

import { Field, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Icon } from '../../../Icon/Icon';
import { Popover } from '../../../Tooltip/Popover';
import { FilterOperator, FilterType, TableRow } from '../types';
import { getDisplayName } from '../utils';

import { FilterPopup } from './FilterPopup';
import { operatorSelectableValues } from './utils';

interface Props {
  name: string;
  rows: TableRow[];
  filter: FilterType;
  setFilter: React.Dispatch<React.SetStateAction<FilterType>>;
  field?: Field;
  iconClassName?: string;
  parentIndex?: number;
}

export const Filter = memo(({ name, rows, filter, setFilter, field, iconClassName, parentIndex }: Props) => {
  const filterKey = typeof parentIndex === 'number' ? `${name}-${parentIndex}` : name;
  const filterValue = filter[filterKey]?.filtered;

  const ref = useRef<HTMLButtonElement>(null);
  const [isPopoverVisible, setPopoverVisible] = useState<boolean>(false);
  const styles = useStyles2(getStyles);
  const filterEnabled = Boolean(filterValue);
  const [searchFilter, setSearchFilter] = useState(filter[filterKey]?.searchFilter || '');
  const [operator, setOperator] = useState<SelectableValue<FilterOperator>>(
    filter[filterKey]?.operator || operatorSelectableValues()[FilterOperator.CONTAINS]
  );

  return (
    <button
      className={styles.headerFilter}
      ref={ref}
      type="button"
      aria-haspopup="dialog"
      aria-pressed={isPopoverVisible}
      aria-label={t('grafana-ui.table.filter.button', `Filter {{name}}`, {
        name: field ? getDisplayName(field) : '',
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
      <Icon name="filter" className={clsx(iconClassName, filterEnabled ? styles.filterIconEnabled : undefined)} />
      {isPopoverVisible && ref.current && (
        <Popover
          content={
            <FilterPopup
              name={name}
              rows={rows}
              filterValue={filterValue}
              setFilter={setFilter}
              field={field}
              onClose={() => setPopoverVisible(false)}
              searchFilter={searchFilter}
              setSearchFilter={setSearchFilter}
              operator={operator}
              setOperator={setOperator}
              buttonElement={ref.current}
              parentIndex={parentIndex}
            />
          }
          placement="bottom-start"
          referenceElement={ref.current}
          show
        />
      )}
    </button>
  );
});

Filter.displayName = 'Filter';

const getStyles = (theme: GrafanaTheme2) => ({
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
});
