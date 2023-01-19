import { css, cx } from '@emotion/css';
import React, { memo } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { GrafanaTheme2, TimeOption } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';
import { getFocusStyles } from '../../../themes/mixins';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      display: flex;
      align-items: center;
      flex-direction: row-reverse;
      justify-content: space-between;
    `,
    selected: css`
      background: ${theme.colors.action.selected};
      font-weight: ${theme.typography.fontWeightMedium};
    `,
    radio: css`
      opacity: 0;
      width: 0 !important;

      &:focus-visible + label {
        ${getFocusStyles(theme)};
      }
    `,
    label: css`
      cursor: pointer;
      flex: 1;
      padding: 7px 9px 7px 9px;

      &:hover {
        background: ${theme.colors.action.hover};
        cursor: pointer;
      }
    `,
  };
};

interface Props {
  value: TimeOption;
  selected?: boolean;
  onSelect: (option: TimeOption) => void;
  /**
   *  Input identifier. This should be the same for all options in a group.
   */
  name: string;
}

export const TimeRangeOption = memo<Props>(({ value, onSelect, selected = false, name }) => {
  const styles = useStyles2(getStyles);
  // In case there are more of the same timerange in the list
  const id = uuidv4();

  return (
    <li className={cx(styles.container, selected && styles.selected)}>
      <input
        className={styles.radio}
        checked={selected}
        name={name}
        type="checkbox"
        id={id}
        onChange={() => onSelect(value)}
      />
      <label className={styles.label} htmlFor={id}>
        {value.display}
      </label>
    </li>
  );
});

TimeRangeOption.displayName = 'TimeRangeOption';
