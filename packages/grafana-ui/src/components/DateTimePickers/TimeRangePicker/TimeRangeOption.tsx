import React, { memo } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2, TimeOption } from '@grafana/data';
import { useStyles2 } from '../../../themes/ThemeContext';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 9px 7px 9px;

      &:hover {
        background: ${theme.colors.action.hover};
        cursor: pointer;
      }
    `,
    selected: css`    
      background: ${theme.colors.action.selected};    
    }
  `,
  };
};

interface Props {
  value: TimeOption;
  selected?: boolean;
  onSelect: (option: TimeOption) => void;
}

export const TimeRangeOption = memo<Props>(({ value, onSelect, selected = false }) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.container, selected && styles.selected)} onClick={() => onSelect(value)} tabIndex={-1}>
      <span>{value.display}</span>
    </div>
  );
});

TimeRangeOption.displayName = 'TimeRangeOption';
