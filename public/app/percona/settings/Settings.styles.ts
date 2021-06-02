import { stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const getSettingsStyles = stylesFactory((theme: GrafanaTheme) => {
  const { spacing } = theme;
  const mq = `@media (max-width: ${theme.breakpoints.md})`;

  return {
    wrapper: css`
      ${mq} {
        width: 100%;
      }
    `,
    settingsWrapper: css`
      display: flex;
      flex-wrap: wrap;
      ${mq} {
        flex-direction: column;
      }
    `,
    settingsLoading: css`
      align-items: center;
      display: flex;
    `,
    tabsWrapper: css`
      margin-right: 40px;
      height: fit-content;
      min-width: 230px;
      ${mq} {
        margin-right: 0;
        margin-bottom: ${spacing.lg};
        width: 100%;
      }
    `,
    tabContentWrapper: css`
      border-left: ${theme.border.width.sm} solid ${theme.colors.pageHeaderBorder};
      flex: 1;
      padding: 0 0 0 60px;
      position: relative;
      ${mq} {
        border: none;
        padding: 0;
        margin-bottom: ${spacing.lg};
      }
    `,
    diagnosticsWrapper: css`
      align-items: flex-end;
      display: flex;
      flex: 1;
      flex-direction: column;
    `,
    labelWrapper: css`
      display: flex;
      svg {
        margin-left: ${theme.spacing.xs};
      }
    `,
    actionButton: css`
      margin-top: ${theme.spacing.sm};
      width: fit-content;
      i {
        margin-right: ${theme.spacing.sm};
      }
      span {
        display: flex;
      }
    `,
  };
});
