import React, { memo } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme, TimeOption } from '@grafana/data';
import { useTheme, stylesFactory } from '../../../themes';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 9px 7px 9px;

      &:hover {
        background: ${theme.v2.palette.action.hover};
        cursor: pointer;
      }
    `,
    selected: css`    
      background: ${theme.v2.palette.action.selected};    
    }
  `,
  };
});

interface Props {
  value: TimeOption;
  selected?: boolean;
  onSelect: (option: TimeOption) => void;
}

export const TimeRangeOption = memo<Props>(({ value, onSelect, selected = false }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={cx(styles.container, selected && styles.selected)} onClick={() => onSelect(value)} tabIndex={-1}>
      <span>{value.display}</span>
    </div>
  );
});

TimeRangeOption.displayName = 'TimeRangeOption';
