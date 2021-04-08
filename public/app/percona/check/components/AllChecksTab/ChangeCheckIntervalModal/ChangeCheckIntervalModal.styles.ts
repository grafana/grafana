import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme) => ({
  title: css`
    margin-bottom: ${theme.spacing.xl};
  `,
  content: css`
    text-align: center;
    word-break: break-word;
  `,
  intervalRadioWrapper: css`
    margin-bottom: ${theme.spacing.lg};
    display: inline-flex;
  `,
});
