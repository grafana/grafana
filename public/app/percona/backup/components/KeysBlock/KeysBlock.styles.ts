import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ typography }: GrafanaTheme) => ({
  keysWrapper: css`
    display: flex;
    flex-direction: column;
    justify-content: center;
  `,
  keyLabel: css`
    display: inline-block;
    width: 85px;
    font-weight: ${typography.weight.semibold};
  `,
  secretTogglerWrapper: css`
    display: inline-block;
  `,
});
