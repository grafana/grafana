import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getWrapButtonStyles = (theme: GrafanaTheme2, expanded: boolean) => {
  return {
    menuItemActive: css({
      '&:before': {
        content: '""',
        position: 'absolute',
        left: 0,
        top: theme.spacing(0.5),
        height: `calc(100% - ${theme.spacing(1)})`,
        width: '2px',
        backgroundColor: theme.colors.warning.main,
      },
    }),
  };
};
