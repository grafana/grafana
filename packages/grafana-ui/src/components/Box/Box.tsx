import { css } from '@emotion/css';
import React, { useCallback } from 'react';

import { GrafanaTheme2, ThemeSpacingTokens } from '@grafana/data';

import { useStyles2 } from '../../themes';

type ExtendSpacing = {
  vertical?: ThemeSpacingTokens;
  horizontal?: ThemeSpacingTokens;
  top?: ThemeSpacingTokens;
  bottom?: ThemeSpacingTokens;
  left?: ThemeSpacingTokens;
  right?: ThemeSpacingTokens;
};
type Spacing = ThemeSpacingTokens | ExtendSpacing;

interface BoxProps {
  margin?: Spacing;
  padding?: Spacing;
  backgroundColor?: keyof GrafanaTheme2['colors']['background'];
}

export const Box = ({ children, ...props }: React.PropsWithChildren<BoxProps>) => {
  const styles = useStyles2(useCallback((theme) => getStyles(theme, props), [props]));

  return <div className={styles.root}>{children}</div>;
};

const getSpacing = (theme: GrafanaTheme2, spacing: Spacing = 0) => {
  if (typeof spacing === 'number') {
    return theme.spacing(spacing);
  }
  const getValue = (prio1: 'top' | 'bottom' | 'left' | 'right', prio2: 'vertical' | 'horizontal') => {
    return spacing?.[prio1] ?? spacing?.[prio2] ?? 0;
  };

  return theme.spacing(
    getValue('top', 'vertical'),
    getValue('right', 'horizontal'),
    getValue('bottom', 'vertical'),
    getValue('left', 'horizontal')
  );
};

const getStyles = (theme: GrafanaTheme2, props: BoxProps) => {
  return {
    root: css({
      margin: getSpacing(theme, props.margin),
      padding: getSpacing(theme, props.padding),
      backgroundColor: theme.colors.background[props.backgroundColor ?? 'primary'],
    }),
  };
};
