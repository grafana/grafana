import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';

export const getStyles = stylesFactory(({ spacing }: GrafanaTheme) => ({
  advancedWrapper: css`
    form {
      width: 100%;
    }
  `,
  advancedRow: css`
    display: flex;
    padding-bottom: ${spacing.md};
  `,
  advancedCol: css`
    align-items: center;
    display: flex;
    width: 180px;
  `,
}));
