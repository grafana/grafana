import { css } from '@emotion/css';

import { GrafanaTheme2, ThemeSpacingTokens } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

interface DividerProps {
  direction?: 'vertical' | 'horizontal';
  spacing?: ThemeSpacingTokens;
}

export const Divider = ({ direction = 'horizontal', spacing = 2 }: DividerProps) => {
  const styles = useStyles2(getStyles, spacing);

  if (direction === 'vertical') {
    return <div className={styles.verticalDivider}></div>;
  } else {
    return <hr className={styles.horizontalDivider} />;
  }
};

Divider.displayName = 'Divider';

const getStyles = (theme: GrafanaTheme2, spacing: ThemeSpacingTokens) => {
  return {
    horizontalDivider: css({
      borderTop: `1px solid ${theme.colors.border.weak}`,
      margin: theme.spacing(spacing, 0),
      width: '100%',
    }),
    verticalDivider: css({
      borderRight: `1px solid ${theme.colors.border.weak}`,
      margin: theme.spacing(0, spacing),
      height: '100%',
    }),
  };
};
