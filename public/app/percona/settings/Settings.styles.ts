import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

export const getSettingsStyles = ({ v1: { spacing }, breakpoints }: GrafanaTheme2) => {
  const mq = `@media (max-width: ${breakpoints.up('md')})`;

  return {
    pageContent: css`
      ${breakpoints.up('md')} {
        margin-right: auto !important;
        width: 45% !important;
      }
    `,
    wrapper: css`
      ${mq} {
        width: 100%;
      }
    `,
    labelWrapper: css`
      display: flex;
      flex-wrap: wrap;
      svg {
        margin-left: ${spacing.xs};
      }
    `,
    actionButton: css`
      margin-top: ${spacing.sm};
      width: fit-content;
      i {
        margin-right: ${spacing.sm};
      }
      span {
        display: flex;
      }
    `,
    tabs: css`
      background: transparent;
    `,
  };
};
