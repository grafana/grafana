import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getCardStyles = (theme: GrafanaTheme2) => {
  return {
    heading: css({
      fontWeight: 400,
      '> button': {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: theme.spacing(1),
      },
    }),
    titleRow: css({
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'nowrap',
      width: '100%',
    }),
    description: css({
      fontSize: theme.typography.bodySmall.fontSize,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
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
    cardApplicableInfo: css({
      position: 'absolute',
      bottom: theme.spacing(1),
      right: theme.spacing(1),
    }),
    newCard: css({
      maxWidth: '200px',
      gridTemplateRows: 'min-content 0 1fr 0',
      marginBottom: 0,
    }),
    pluginStateInfoWrapper: css({
      marginLeft: theme.spacing(0.5),
    }),
    tagsWrapper: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(0.5),
    }),
  };
};
