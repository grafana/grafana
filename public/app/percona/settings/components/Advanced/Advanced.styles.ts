import { stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const getStyles = stylesFactory(({ breakpoints, spacing, typography, border, colors }: GrafanaTheme) => {
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
      width: 210px;
    `,
    advancedChildCol: css`
      width: 150px;
      margin-left: 30px;
    `,
    inputWrapper: css`
      align-items: center;
      display: flex;
      input {
        width: 60px;
      }
      div {
        margin: 0;
        div[class*='-error'] {
          position: absolute;
        }
      }
    `,
    unitsLabel: css`
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
    sttCheckIntervalsLabel: css`
      margin-top: ${spacing.sm};
      margin-bottom: ${spacing.sm};
    `,
    technicalPreview: css`
      border: ${border.width.sm} solid ${colors.pageHeaderBorder};
      padding: ${spacing.md};
      border-radius: ${border.radius.sm};
      width: 950px;

      ${mq} {
        width: 100%;
      }

      legend {
        font-size: 14px;
        width: auto;
        padding: 0 ${spacing.sm};
      }
    `,
    infoBox: css`
      display: flex;
      align-items: center;
      border: ${border.width.sm} solid ${colors.pageHeaderBorder};
      border-radius: ${border.radius.sm};
      color: ${colors.textWeak};
      padding: ${spacing.sm};
      margin-bottom: ${spacing.lg};

      p {
        margin: 0;
      }

      a {
        color: ${colors.linkExternal};
      }
    `,
    infoBoxIcon: css`
      margin: ${spacing.sm};
      fill: ${colors.linkExternal};
    `,
  };
});
