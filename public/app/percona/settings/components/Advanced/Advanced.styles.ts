import { stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const getStyles = stylesFactory(({ breakpoints, spacing, typography }: GrafanaTheme) => {
  const mq = `@media (max-width: ${breakpoints.md})`;

  return {
    advancedWrapper: css`
      form {
        width: 100%;
      }
    `,
    advancedRow: css`
      display: flex;
      align-items: baseline;
      padding-bottom: ${spacing.md};
    `,
    advancedCol: css`
      align-items: center;
      display: flex;
      width: 180px;
    `,
    retentionInputWrapper: css`
      display: flex;
      div {
        margin: 0;
        div[class*='-error'] {
          position: absolute;
        }
      }
    `,
    retentionUnitslabel: css`
      font-size: ${typography.size.sm};
      margin-left: ${spacing.sm};
    `,
    switchDisabled: css`
      label: disabled;
      opacity: 0.6;
    `,
    publicAddressLabelWrapper: css`
      align-items: start;
      margin-top: ${spacing.sm};
    `,
    publicAddressWrapper: css`
      display: flex;
      div {
        margin-bottom: 0 !important;
      }
      ${mq} {
        flex-direction: column;
      }
    `,
    publicAddressInput: css`
      width: 200px;
      ${mq} {
        width: 100px;
      }
    `,
    publicAddressButton: css`
      margin-left: ${spacing.md};
      margin-top: ${spacing.xxs};
      svg {
        margin-right: ${spacing.sm};
      }
      ${mq} {
        margin-left: 0;
      }
    `,
  };
});
