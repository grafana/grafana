import { css, cx } from '@emotion/css';
import React, { FC, useCallback, useMemo, useRef, useState } from 'react';

import { Field, GrafanaTheme } from '@grafana/data';

import { Popover } from '..';
import { stylesFactory, useStyles } from '../../themes';
import { Icon } from '../Icon/Icon';

import { FilterPopup } from './FilterPopup';
import { TableStyles } from './styles';

interface Props {
  column: any;
  tableStyles: TableStyles;
  field?: Field;
}

export const Filter: FC<Props> = ({ column, field, tableStyles }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [isPopoverVisible, setPopoverVisible] = useState<boolean>(false);
  const styles = useStyles(getStyles);
  const filterEnabled = useMemo(() => Boolean(column.filterValue), [column.filterValue]);
  const onShowPopover = useCallback(() => setPopoverVisible(true), [setPopoverVisible]);
  const onClosePopover = useCallback(() => setPopoverVisible(false), [setPopoverVisible]);

  if (!field || !field.config.custom?.filterable) {
    return null;
  }
  return (
    <button
      className={cx(tableStyles.headerFilter, filterEnabled ? styles.filterIconEnabled : styles.filterIconDisabled)}
      ref={ref}
      type="button"
      onClick={onShowPopover}
    >
      <Icon name="filter" />
      {isPopoverVisible && ref.current && (
        <Popover
          content={<FilterPopup column={column} tableStyles={tableStyles} field={field} onClose={onClosePopover} />}
          placement="bottom-start"
          referenceElement={ref.current}
          show
        />
      )}
    </button>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  filterIconEnabled: css`
    label: filterIconEnabled;
    color: ${theme.colors.textBlue};
  `,
  filterIconDisabled: css`
    label: filterIconDisabled;
    color: ${theme.colors.textFaint};
  `,
}));
