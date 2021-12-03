import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ breakpoints, colors, spacing, typography }: GrafanaTheme) => ({
  legend: css`
    color: ${colors.formLabel};
    font-size: ${typography.heading.h3};
    font-weight: ${typography.weight.regular};
    margin: ${spacing.formLabelMargin};
    margin-bottom: ${spacing.lg};
  `,
  form: css`
    max-width: 500px;
    min-width: 150px;
    width: 100%;
  `,
  submitButton: css`
    padding-left: 50px;
    padding-right: 50px;
    margin-bottom: ${spacing.formInputMargin};

    @media (max-width: ${breakpoints.md}) {
      display: flex;
      justify-content: center;
      width: 100%;
    }
  `,
});
