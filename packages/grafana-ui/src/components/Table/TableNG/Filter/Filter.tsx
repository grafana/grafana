import { css, cx } from '@emotion/css';
import { useCallback, useMemo, useRef, useState } from 'react';

import { Field, GrafanaTheme2, SelectableValue } from '@grafana/data';

import { Popover } from '../../..';
import { useStyles2 } from '../../../../themes';
import { Icon } from '../../../Icon/Icon';
import { TableRow } from '../../types';

import { REGEX_OPERATOR } from './FilterList';
import { FilterPopup } from './FilterPopup';

interface Props {
  name: string;
  rows: any[];
  filter: any;
  setFilter: (value: any) => void;
  field?: Field;
  crossFilterOrder: string[];
  crossFilterRows: { [key: string]: TableRow[] };
}

export const Filter = ({ name, rows, filter, setFilter, field, crossFilterOrder, crossFilterRows }: Props) => {
  const filterValue = filter[name]?.filtered;

  // get rows for cross filtering
  const nameIndex = crossFilterOrder.indexOf(name);
  let newRows: TableRow[];
  if (nameIndex > 0) {
    // current filter list should be based on the previous filter list
    const prevName = crossFilterOrder[nameIndex - 1];
    newRows = crossFilterRows[prevName];
  } else if (nameIndex === -1 && crossFilterOrder.length > 0) {
    // current filter list should be based on the last filter list
    const prevName = crossFilterOrder[crossFilterOrder.length - 1];
    newRows = crossFilterRows[prevName];
  } else {
    newRows = rows;
  }

  // const filterIndex = crossFilterOrder.indexOf(name);
  // const previousFilterName = filterIndex > 0
  //   ? crossFilterOrder[filterIndex - 1]
  //   : crossFilterOrder[crossFilterOrder.length - 1];

  // // if filter is not applied or no cross filters are applied, return all rows
  // // else return rows based on previous (cross) filter
  // const filteredRows = filterIndex !== -1 || crossFilterOrder.length === 0
  //   ? rows
  //   : crossFilterRows[previousFilterName];

  const ref = useRef<HTMLButtonElement>(null);
  const [isPopoverVisible, setPopoverVisible] = useState<boolean>(false);
  const styles = useStyles2(getStyles);
  const filterEnabled = useMemo(() => Boolean(filterValue), [filterValue]);
  const onShowPopover = useCallback(() => setPopoverVisible(true), [setPopoverVisible]);
  const onClosePopover = useCallback(() => setPopoverVisible(false), [setPopoverVisible]);
  const [searchFilter, setSearchFilter] = useState(filter[name]?.searchFilter || '');
  const [operator, setOperator] = useState<SelectableValue<string>>(filter[name]?.operator || REGEX_OPERATOR);

  return (
    <button
      className={cx(styles.headerFilter, filterEnabled ? styles.filterIconEnabled : styles.filterIconDisabled)}
      ref={ref}
      type="button"
      onClick={onShowPopover}
    >
      <Icon name="filter" />
      {isPopoverVisible && ref.current && (
        <Popover
          content={
            <FilterPopup
              name={name}
              rows={newRows}
              // rows={filteredRows}
              filterValue={filterValue}
              setFilter={setFilter}
              field={field}
              onClose={onClosePopover}
              searchFilter={searchFilter}
              setSearchFilter={setSearchFilter}
              operator={operator}
              setOperator={setOperator}
            />
          }
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
  }),
  filterIconEnabled: css({
    label: 'filterIconEnabled',
    color: theme.colors.primary.text,
  }),
  filterIconDisabled: css({
    label: 'filterIconDisabled',
    color: theme.colors.text.disabled,
  }),
});
