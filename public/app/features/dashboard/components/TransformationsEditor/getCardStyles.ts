import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getCardStyles = (theme: GrafanaTheme2) => {
  return {
    baseCard: css({
      maxWidth: '200px',
      marginBottom: 0,
    }),
    image: css({
      display: 'block',
      maxWidth: '100%',
      marginTop: theme.spacing(2),
    }),
    cardDisabled: css({
      backgroundColor: theme.colors.action.disabledBackground,
      img: {
        filter: 'grayscale(100%)',
        opacity: 0.33,
      },
    }),
    applicableInfoButton: css({
      position: 'absolute',
      bottom: theme.spacing(1),
      right: theme.spacing(1),
    }),
    tagsWrapper: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(0.5),
      marginTop: theme.spacing(0.5),
    }),
  };
};
