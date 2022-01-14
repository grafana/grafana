import { stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

export const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const { spacing, colors } = theme;

  return {
    resourcesWrapper: css`
      display: flex;
    `,
    resourcesInputCol: css`
      display: flex;
      flex-direction: column;
      div {
        white-space: nowrap;
        width: 100px;
      }
      div:not(:last-child) {
        margin-bottom: ${spacing.xl};
      }
    `,
    resourcesBarCol: css`
      display: flex;
      flex-direction: column;
      margin-left: ${spacing.lg};
      width: 50%;
    `,
    nodesWrapper: css`
      margin-bottom: ${spacing.md};
      width: 60px;
      div,
      label {
        white-space: nowrap;
      }
    `,
    resourcesBar: css`
      margin-top: ${spacing.lg};
      margin-bottom: 54px;
    `,
    resourcesBarEmpty: css`
      margin-top: ${spacing.lg};
      margin-bottom: 78px;
    `,
    resourcesBarLast: css`
      margin-top: ${spacing.lg};
    `,
    resourcesInfoWrapper: css`
      display: flex;
      align-items: center;
      background-color: ${colors.bg2};
      padding: ${spacing.sm};
      width: fit-content;
      margin-bottom: ${spacing.md};
    `,
    resourcesInfoIcon: css`
      margin-right: ${spacing.sm};
    `,
    resourcesRadioWrapper: css`
      align-items: center;
      display: flex;
      justify-content: space-between;
    `,
  };
});
