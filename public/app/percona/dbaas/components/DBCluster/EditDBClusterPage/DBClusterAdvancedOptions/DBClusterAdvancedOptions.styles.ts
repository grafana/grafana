import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '@grafana/ui/src';

export const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const { spacing } = theme;

  return {
    resourcesWrapper: css`
      display: flex;
    `,
    resourcesInputCol: css`
      display: flex;
      flex-direction: column;
      div {
        width: 100px;
      }
      div:not(:last-child) {
        margin-bottom: ${spacing.xl};
      }
    `,
    resourcesBarCol: css`
      display: flex;
      flex-direction: column;
      margin-left: ${spacing.xl};
      width: 336px;
    `,
    nodesWrapper: css`
      margin-bottom: ${spacing.md};
      flex: 1 0 auto;
      div,
      label {
        white-space: nowrap;
        margin-left: ${spacing.md};
      }
    `,
    resourcesBar: css`
      margin-top: ${spacing.lg};
      margin-bottom: 67px;
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
      padding: ${spacing.sm};
      width: fit-content;
    `,
    resourcesInfoIcon: css`
      margin-right: ${spacing.sm};
    `,
    resourcesRadioWrapper: css`
      align-items: center;
      display: flex;
      justify-content: space-between;
      width: 760px;
    `,
    line: css`
      display: flex;
    `,
    resourcesRadioBtnGroup: css`
      & {
        > div:nth-child(3) {
          label {
            height: 37px; //TODO create the common system of components with one height for forms
            align-items: center;
            min-width: 118px;
          }
        }
      }
    `,
  };
});
