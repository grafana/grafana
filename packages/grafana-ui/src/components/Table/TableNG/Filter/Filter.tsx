import { css, cx } from '@emotion/css';
import { useCallback, useMemo, useRef, useState } from 'react';

import { Field, GrafanaTheme2, SelectableValue } from '@grafana/data';

import { Popover } from '../../..';
import { useStyles2 } from '../../../../themes';
import { Icon } from '../../../Icon/Icon';

import { REGEX_OPERATOR } from './FilterList';
import { FilterPopup } from './FilterPopup';

interface Props {
  column: any;
  field?: Field;
}

export const Filter = ({ column, field }: Props) => {
  const { filterValue } = column;

  const ref = useRef<HTMLButtonElement>(null);
  const [isPopoverVisible, setPopoverVisible] = useState<boolean>(false);
  const styles = useStyles2(getStyles);
  const filterEnabled = useMemo(() => Boolean(filterValue), [filterValue]);
  const onShowPopover = useCallback(() => setPopoverVisible(true), [setPopoverVisible]);
  const onClosePopover = useCallback(() => setPopoverVisible(false), [setPopoverVisible]);
  const [searchFilter, setSearchFilter] = useState('');
  const [operator, setOperator] = useState<SelectableValue<string>>(REGEX_OPERATOR);

  // if (!field || !field.config.custom?.filterable) {
  //   return null;
  // }

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
              column={column}
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
