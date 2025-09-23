import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ v1: { spacing, palette, typography, colors } }: GrafanaTheme2) => ({
  field: css`
    &:not(:last-child) {
      margin-bottom: ${spacing.formInputMargin};
    }
    & > div.invalid {
      border-color: ${colors.formInputBorderInvalid};
      &:hover {
        border-color: ${colors.formInputBorderInvalid};
      }
    }
    input {
      height: 35px;
    }
  `,

  errorMessage: css`
    color: ${palette.redBase};
    font-size: ${typography.size.sm};
    height: ${typography.size.sm};
    line-height: ${typography.lineHeight.sm};
    margin: ${spacing.formValidationMessageMargin};
    padding: ${spacing.formLabelPadding};
  `,
});
