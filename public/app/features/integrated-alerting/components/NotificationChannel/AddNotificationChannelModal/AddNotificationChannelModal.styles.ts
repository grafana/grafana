import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ colors, spacing, typography }: GrafanaTheme) => ({
  label: css`
    display: block;
    text-align: left;
    font-size: ${typography.size.md};
    font-weight: ${typography.weight.semibold};
    line-height: 1.25;
    margin: ${spacing.formLabelMargin};
    padding: ${spacing.formLabelPadding};
    color: ${colors.formLabel};
  `,
  select: css`
    margin-bottom: ${spacing.xl};
    div[class$='-input-wrapper'] {
      padding: 7px 8px;
    }
  `,
});
