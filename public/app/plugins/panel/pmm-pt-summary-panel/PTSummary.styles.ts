import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2) => ({
  ptSummaryWrapper: css`
    border: 1px solid ${theme.colors.background.canvas};
    border-radius: ${theme.shape.radius.default};
    font-size: ${theme.typography.body.fontSize};
    height: 100%;
  `,
  ptSummary: css`
    border: none;
    color: ${theme.colors.text};
    height: 100%;
    margin: 0;
  `,
});
