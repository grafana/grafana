import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ colors, typography, spacing, border }: GrafanaTheme) => ({
  retryFields: css`
    display: flex;
  `,
  retrySelect: css`
    flex: 1 1 50%;

    &:first-child {
      padding-right: ${spacing.sm};
    }

    &:last-child {
      padding-left: ${spacing.sm};
    }
  `,
  formContainer: css`
    display: flex;
    flex-wrap: wrap;
  `,
  formHalf: css`
    flex: 0 0 50%;

    &:first-child {
      padding-right: ${spacing.md};
    }

    &:last-child {
      padding-left: ${spacing.md};
    }
  `,
  advancedGroup: css`
    border: ${border.width.sm} solid ${colors.formInputBorder};
    border-radius: ${border.radius.sm};
    padding: ${spacing.md};
    margin-bottom: ${spacing.formInputMargin};
    position: relative;
  `,
  advancedTitle: css`
    color: ${colors.formLabel};
    font-weight: ${typography.weight.semibold};
    position: absolute;
    top: -8px;
    padding: 0 ${spacing.xs};
    background-color: ${colors.bodyBg};
  `,
  advancedRow: css`
    display: flex;
    max-width: 400px;
    margin: 0 auto;

    & > * {
      flex: 1 0 50%;

      &:first-child {
        padding-right: ${spacing.sm};
      }

      &:last-child {
        padding-left: ${spacing.sm};
      }

      &:first-child:last-child {
        padding-right: 0;
        padding-left: 0;
      }
    }
  `,
  checkbox: css`
    &:not(:last-child) {
      margin-bottom: 0;
    }

    & > div:last-child {
      // we don't need the error line in this case
      display: none;
    }
  `,
  apiErrorSection: css`
    margin-bottom: ${spacing.md};
  `,
});
