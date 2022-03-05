import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data/src';

export const getStyles = ({ spacing }: GrafanaTheme) => ({
  checkbox: css`
    span {
      top: 0;
    }
  `,
  urlWarningWrapper: css`
    margin-bottom: ${spacing.md};
  `,
});
