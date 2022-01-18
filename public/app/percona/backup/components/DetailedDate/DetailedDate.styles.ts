import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ typography, colors, spacing }: GrafanaTheme) => ({
  hourWrapper: css`
    font-size: ${typography.size.sm};
    color: ${colors.textSemiWeak};
    margin-left: ${spacing.xxs};
  `,
});
