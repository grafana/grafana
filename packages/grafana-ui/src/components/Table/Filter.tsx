import React, { FC, useCallback, useMemo, useRef, useState } from 'react';
import { css, cx } from 'emotion';
import { Field, GrafanaTheme } from '@grafana/data';

import { TableStyles } from './styles';
import { stylesFactory, useStyles } from '../../themes';
import { Icon } from '../Icon/Icon';
import { FilterPopup } from './FilterPopup';
import { Popover } from '..';

interface Props {
  column: any;
  tableStyles: TableStyles;
  field?: Field;
}

export const Filter: FC<Props> = ({ column, field, tableStyles }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isPopoverVisible, setPopoverVisible] = useState<boolean>(false);
  const styles = useStyles(getStyles);
  const filterEnabled = useMemo(() => Boolean(column.filterValue), [column.filterValue]);
  const onShowPopover = useCallback(() => setPopoverVisible(true), [setPopoverVisible]);
  const onClosePopover = useCallback(() => setPopoverVisible(false), [setPopoverVisible]);

  if (!field || !field.config.custom?.filterable) {
    return null;
  }

  return (
    <span
      className={cx(tableStyles.headerFilter, filterEnabled ? styles.filterIconEnabled : styles.filterIconDisabled)}
      ref={ref}
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
    </span>
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
