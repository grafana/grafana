import React, { FC, useMemo, useRef, useState } from 'react';
import { css, cx } from 'emotion';
import { Field, GrafanaTheme } from '@grafana/data';

import { TableStyles } from './styles';
import { stylesFactory, useTheme } from '../../themes';
import { Icon } from '../Icon/Icon';
import { FilterPopup } from './FilterPopup';
import { Popover } from '..';

interface Props {
  column: any;
  tableStyles: TableStyles;
  field?: Field;
}

export const Filter: FC<Props> = ({ column, field, tableStyles }) => {
  const [isPopupVisible, setPopupVisible] = useState<boolean>(false);
  const theme = useTheme();
  const styles = getStyles(theme);
  const filterEnabled = useMemo(() => !!column.filterValue, [column.filterValue]);
  const ref = useRef<HTMLDivElement>(null);

  if (!field) {
    return null;
  }

  return (
    <div
      className={cx(tableStyles.headerFilter, filterEnabled ? styles.filterIconEnabled : styles.filterIconDisabled)}
      ref={ref}
      onClick={() => setPopupVisible(true)}
    >
      <Icon name="filter" />
      {isPopupVisible && ref.current && (
        <Popover
          content={
            <FilterPopup
              column={column}
              tableStyles={tableStyles}
              field={field}
              onHide={() => setPopupVisible(false)}
            />
          }
          placement="bottom-start"
          referenceElement={ref.current}
          show
        />
      )}
    </div>
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
