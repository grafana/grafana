import { css, cx } from '@emotion/css';
import { useRef, useState } from 'react';

import { Field, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { Icon } from '../../../Icon/Icon';
import { Popover } from '../../../Tooltip/Popover';
import { FilterType, TableRow } from '../types';

import { REGEX_OPERATOR } from './FilterList';
import { FilterPopup } from './FilterPopup';

interface Props {
  name: string;
  rows: any[];
  filter: FilterType;
  setFilter: (value: FilterType) => void;
  field?: Field;
  crossFilterOrder: string[];
  crossFilterRows: { [key: string]: TableRow[] };
  iconClassName?: string;
}

export const Filter = ({
  name,
  rows,
  filter,
  setFilter,
  field,
  crossFilterOrder,
  crossFilterRows,
  iconClassName,
}: Props) => {
  const filterValue = filter[name]?.filtered;

  // get rows for cross filtering
  const filterIndex = crossFilterOrder.indexOf(name);
  let filteredRows: TableRow[];
  if (filterIndex > 0) {
    // current filter list should be based on the previous filter list
    const previousFilterName = crossFilterOrder[filterIndex - 1];
    filteredRows = crossFilterRows[previousFilterName];
  } else if (filterIndex === -1 && crossFilterOrder.length > 0) {
    // current filter list should be based on the last filter list
    const previousFilterName = crossFilterOrder[crossFilterOrder.length - 1];
    filteredRows = crossFilterRows[previousFilterName];
  } else {
    filteredRows = rows;
  }

  const ref = useRef<HTMLButtonElement>(null);
  const [isPopoverVisible, setPopoverVisible] = useState<boolean>(false);
  const styles = useStyles2(getStyles);
  const filterEnabled = Boolean(filterValue);
  const [searchFilter, setSearchFilter] = useState(filter[name]?.searchFilter || '');
  const [operator, setOperator] = useState<SelectableValue<string>>(filter[name]?.operator || REGEX_OPERATOR);

  return (
    <button
      className={styles.headerFilter}
      ref={ref}
      type="button"
      data-testid={selectors.components.Panels.Visualization.TableNG.Filters.HeaderButton}
      onClick={(ev) => {
        setPopoverVisible(true);
        ev.stopPropagation();
      }}
    >
      <Icon name="filter" className={cx(iconClassName, { [styles.filterIconEnabled]: filterEnabled })} />
      {isPopoverVisible && ref.current && (
        <Popover
          content={
            <FilterPopup
              name={name}
              rows={filteredRows}
              filterValue={filterValue}
              setFilter={setFilter}
              field={field}
              onClose={() => setPopoverVisible(false)}
              searchFilter={searchFilter}
              setSearchFilter={setSearchFilter}
              operator={operator}
              setOperator={setOperator}
            />
          }
          onKeyDown={(event) => {
            if (event.key === ' ') {
              event.stopPropagation();
            }
          }}
          placement="bottom-start"
          referenceElement={ref.current}
          show
        />
      )}
    </button>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  headerFilter: css({
    background: 'transparent',
    border: 'none',
    label: 'headerFilter',
    padding: 0,
    alignSelf: 'flex-end',
  }),
  filterIconEnabled: css({
    label: 'filterIconEnabled',
    color: theme.colors.primary.text,
  }),
});
