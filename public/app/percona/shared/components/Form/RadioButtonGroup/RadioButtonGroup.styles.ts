import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1 }: GrafanaTheme2) => {
  const { colors, palette, spacing, typography } = v1;

  return {
    errorMessage: css`
      color: ${palette.redBase};
      font-size: ${typography.size.sm};
      height: ${typography.size.sm};
      line-height: ${typography.lineHeight.sm};
      margin: ${spacing.formValidationMessageMargin};
      padding: ${spacing.formLabelPadding};
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
    wrapper: css`
      position: relative;
      &:not(:last-child) {
        margin-bottom: ${spacing.formInputMargin};
      }
      label {
        border-radius: 0px;
        &:first-of-type {
          border-radius: 2px 0px 0px 2px;
        }
        &:last-of-type {
          border-radius: 0px 2px 2px 0px;
        }
      }
    `,
    input: css`
      display: none;
    `,
    icon: css`
      margin-right: 6px;
    `,
    buttonContainer: css`
      display: flex;
      flex-wrap: wrap;
    `,
  };
};
