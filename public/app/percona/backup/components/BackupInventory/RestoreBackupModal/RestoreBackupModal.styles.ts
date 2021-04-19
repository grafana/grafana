import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ colors, typography, spacing }: GrafanaTheme) => ({
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
  formHalvesContainer: css`
    display: flex;
    margin-bottom: ${spacing.formInputMargin};

    & > div {
      flex: 0 1 50%;

      &:first-child {
        padding-right: ${spacing.md};
      }

      &:last-child {
        padding-left: ${spacing.md};
      }
    }
  `,
  radioGroup: css`
    & > div:nth-last-of-type(2) {
      flex-wrap: nowrap;
    }

    & input[type='radio'] + label {
      height: auto;
      white-space: nowrap;
      padding: 7px 8px;
      line-height: ${typography.lineHeight.md};
    }
  `,
});
