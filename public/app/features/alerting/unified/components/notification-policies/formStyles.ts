import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getFormStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      alignItems: 'center',
      display: 'flex',
      flexFlow: 'row nowrap',

      '& > * + *': {
        marginLeft: theme.spacing(1),
      },
    }),
    input: css({
      flex: 1,
    }),
    promDurationInput: css({
      maxWidth: theme.spacing(32),
    }),
    timingFormContainer: css({
      padding: theme.spacing(1),
    }),
    linkText: css({
      textDecoration: 'underline',
    }),
    collapse: css({
      border: 'none',
      background: 'none',
      color: theme.colors.text.primary,
    }),
  };
};
