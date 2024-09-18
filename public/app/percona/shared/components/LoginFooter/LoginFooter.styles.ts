import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2) => ({
  footer: css`
    color: ${theme.colors.text.primary};
    padding: ${theme.spacing(2)} 0;
    font-size: ${theme.typography.bodySmall.fontSize};
    position: relative;
    width: 98%; /* was causing horiz scrollbars - need to examine */
    display: block;

    a:hover {
      color: ${theme.colors.text.maxContrast};
      text-decoration: 'underline';
    }

    ul {
      list-style: none;
    }

    li {
      display: inline-block;

      &::after {
        content: ', ';
        padding: 0 ${theme.spacing(0.5)} 0 0;
      }
    }

    li:last-child {
      &::after {
        content: '';
      }
    }
  `,
});
