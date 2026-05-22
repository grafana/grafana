import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

export const cardStyle = (theme: GrafanaTheme2, complete: boolean) => {
  const completeGradient = `linear-gradient(to right, ${theme.colors.success.main} 0%, ${theme.colors.success.main} 100%)`;
  const incompleteGradient = theme.colors.gradients.brandHorizontal;

  const borderGradient = complete ? completeGradient : incompleteGradient;

  return {
    backgroundColor: theme.colors.background.secondary,
    marginRight: theme.spacing(4),
    border: `1px solid ${theme.colors.border.weak}`,
    borderBottomLeftRadius: theme.shape.radius.lg,
    borderBottomRightRadius: theme.shape.radius.lg,
    position: 'relative',
    maxHeight: '230px',

    [theme.breakpoints.down('xxl')]: {
      marginRight: theme.spacing(2),
    },
    '&::before': {
      display: 'block',
      content: "' '",
      position: 'absolute',
      left: 0,
      right: 0,
      height: '2px',
      top: 0,
      backgroundImage: borderGradient,
    },
  } as const;
};

export const cardContent = css({
  padding: '16px',
});
