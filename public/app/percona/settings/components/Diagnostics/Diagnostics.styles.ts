import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';

export const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  diagnosticsWrapper: css`
    align-items: flex-end;
    display: flex;
    flex: 1;
    flex-direction: column;
  `,
  diagnosticsLabel: css`
    display: flex;
    i {
      margin-left: ${theme.spacing.xs};
    }
  `,
  diagnosticsButton: css`
    margin-top: ${theme.spacing.md};
    svg {
      margin-right: ${theme.spacing.sm};
    }
  `,
}));
