import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { spacing, typography, colors } }: GrafanaTheme2) => ({
  actionsWrapper: css`
    display: flex;
    justify-content: flex-end;
  `,
  dateWrapper: css`
    font-size: ${typography.size.xs};
    color: ${colors.textFaint};
  `,
});
