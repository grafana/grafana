import { css, cx } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { type Field, type GrafanaTheme2, type SelectableValue } from '@grafana/data';

import { Popover } from '../../../components/Tooltip/Popover';
import { useStyles2 } from '../../../themes/ThemeContext';
import { Icon } from '../../Icon/Icon';

import { REGEX_OPERATOR } from './FilterList';
import { FilterPopup } from './FilterPopup';
import { type TableStyles } from './styles';

interface Props {
  column: any;
  tableStyles: TableStyles;
  field?: Field;
}

export const Filter = ({ column, field, tableStyles }: Props) => {
  const [buttonElement, setButtonElement] = useState<HTMLButtonElement | null>(null);
  const [isPopoverVisible, setPopoverVisible] = useState<boolean>(false);
  const styles = useStyles2(getStyles);
  const filterEnabled = useMemo(() => Boolean(column.filterValue), [column.filterValue]);
  const onShowPopover = useCallback(() => setPopoverVisible(true), [setPopoverVisible]);
  const onClosePopover = useCallback(() => setPopoverVisible(false), [setPopoverVisible]);
  const [searchFilter, setSearchFilter] = useState('');
  const [operator, setOperator] = useState<SelectableValue<string>>(REGEX_OPERATOR);

  if (!field || !field.config.custom?.filterable) {
    return null;
  }
  return (
    <button
      className={cx(tableStyles.headerFilter, filterEnabled ? styles.filterIconEnabled : styles.filterIconDisabled)}
      ref={setButtonElement}
      type="button"
      onClick={onShowPopover}
    >
      <Icon name="filter" />
      {isPopoverVisible && buttonElement && (
        <Popover
          content={
            <FilterPopup
              column={column}
              tableStyles={tableStyles}
              field={field}
              onClose={onClosePopover}
              searchFilter={searchFilter}
              setSearchFilter={setSearchFilter}
              operator={operator}
              setOperator={setOperator}
            />
          }
          placement="bottom-start"
          referenceElement={buttonElement}
          show
        />
      )}
    </button>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  filterIconEnabled: css({
    label: 'filterIconEnabled',
    color: theme.colors.primary.text,
  }),
  filterIconDisabled: css({
    label: 'filterIconDisabled',
    color: theme.colors.text.disabled,
  }),
});
