import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { spacing } }: GrafanaTheme2) => ({
  diagnosticsWrapper: css`
    flex: 1;
  `,
  diagnosticsLabel: css`
    display: flex;
    i {
      margin-left: ${spacing.xs};
    }
  `,
  diagnosticsButton: css`
    margin-top: ${spacing.md};
    svg {
      margin-right: ${spacing.sm};
    }
  `,
});
