import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ spacing, palette, typography, colors }: GrafanaTheme) => ({
  field: css`
    &:not(:last-child) {
      margin-bottom: ${spacing.formInputMargin};
    }
  `,
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
  labelWrapper: css`
    align-items: center;
    display: flex;
    flex-direction: row;
    div[class$='-Icon'] {
      display: flex;
      margin-left: ${spacing.xs};
    }
  `,
  errorMessage: css`
    color: ${palette.red};
    font-size: ${typography.size.sm};
    height: ${typography.size.sm};
    line-height: ${typography.lineHeight.sm};
    margin-top: ${spacing.sm};
    margin-bottom: ${spacing.xs};
  `,
});
