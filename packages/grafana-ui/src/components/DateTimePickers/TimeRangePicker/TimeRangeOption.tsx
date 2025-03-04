import { css, cx } from '@emotion/css';
import { memo } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { GrafanaTheme2, TimeOption } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';
import { getFocusStyles } from '../../../themes/mixins';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      alignItems: 'center',
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      position: 'relative',
    }),
    radio: css({
      opacity: 0,
      width: '0 !important',
      '&:focus-visible + label': getFocusStyles(theme),
    }),
    label: css({
      cursor: 'pointer',
      flex: 1,
      padding: theme.spacing(1),
      borderRadius: theme.shape.radius.default,

      '&:hover': {
        background: theme.colors.action.hover,
        cursor: 'pointer',
      },
    }),
    labelSelected: css({
      background: theme.colors.action.selected,

      '&::before': {
        backgroundImage: theme.colors.gradients.brandVertical,
        borderRadius: theme.shape.radius.default,
        content: '" "',
        display: 'block',
        height: '100%',
        position: 'absolute',
        width: theme.spacing(0.5),
        left: 0,
        top: 0,
      },
    }),
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
    <li className={styles.container}>
      <input
        className={styles.radio}
        checked={selected}
        name={name}
        type="checkbox"
        data-role="item"
        tabIndex={-1}
        id={id}
        onChange={() => onSelect(value)}
      />
      <label className={cx(styles.label, selected && styles.labelSelected)} htmlFor={id}>
        {value.display}
      </label>
    </li>
  );
});

TimeRangeOption.displayName = 'TimeRangeOption';
