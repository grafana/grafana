import { css } from '@emotion/css';
export const getStyles = ({ v1: { breakpoints, spacing, typography, border, colors } }) => {
    const mq = `@media (max-width: ${breakpoints.md})`;
    return {
        advancedWrapper: css `
      form {
        width: 100%;
      }
    `,
        advancedRow: css `
      display: flex;
      align-items: baseline;
      padding-bottom: ${spacing.md};
      flex-wrap: wrap;
    `,
        advancedCol: css `
      align-items: center;
      display: flex;
      width: 230px;
    `,
        advancedChildCol: css `
      width: 150px;
      margin-left: 30px;
    `,
        inputWrapper: css `
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
        unitsLabel: css `
      font-size: ${typography.size.sm};
      margin-left: ${spacing.sm};
    `,
        publicAddressLabelWrapper: css `
      align-items: start;
      margin-top: ${spacing.sm};
    `,
        publicAddressWrapper: css `
      display: flex;
      flex-wrap: wrap;
      div {
        margin-bottom: 0 !important;
      }
      ${mq} {
        flex-direction: column;
      }
    `,
        publicAddressInput: css `
      min-width: 213px;
      ${mq} {
        width: 100px;
      }
    `,
        publicAddressButton: css `
      margin-left: ${spacing.md};
      margin-top: ${spacing.xxs};
      svg {
        margin-right: ${spacing.sm};
      }
      ${mq} {
        margin-left: 0;
      }
    `,
        sttCheckIntervalsLabel: css `
      margin-top: ${spacing.sm};
      margin-bottom: ${spacing.sm};
    `,
        technicalPreview: css `
      border: ${border.width.sm} solid ${colors.pageHeaderBorder};
      padding: ${spacing.md};
      border-radius: ${border.radius.sm};

      ${mq} {
        width: 100%;
      }

      legend {
        font-size: 14px;
        width: auto;
        padding: 0 ${spacing.sm};
      }
    `,
        infoBox: css `
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
        infoBoxIcon: css `
      margin: ${spacing.sm};
      fill: ${colors.linkExternal};
    `,
        telemetryTooltip: css `
      overflow: auto;
      max-height: 80vh;
    `,
        telemetryListTooltip: css `
      padding-left: ${spacing.sm};
    `,
    };
};
//# sourceMappingURL=Advanced.styles.js.map