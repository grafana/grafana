import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { colors, typography, spacing } }: GrafanaTheme2) => ({
  wrapper: css`
    max-width: 500px;
  `,
  title: css`
    color: ${colors.formLabel};
    font-size: ${typography.heading.h3};
    font-weight: ${typography.weight.regular};
    margin: ${spacing.formLabelMargin};
    margin-bottom: ${spacing.lg};
  `,
});
