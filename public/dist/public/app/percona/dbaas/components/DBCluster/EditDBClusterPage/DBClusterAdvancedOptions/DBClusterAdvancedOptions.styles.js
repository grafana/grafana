import { css } from '@emotion/css';
import { stylesFactory } from '@grafana/ui/src';
export const getStyles = stylesFactory((theme) => {
    const { spacing } = theme;
    return {
        resourcesWrapper: css `
      display: flex;
    `,
        resourcesInputCol: css `
      display: flex;
      flex-direction: column;
      div {
        width: 100px;
      }
      div:not(:last-child) {
        margin-bottom: ${spacing.xl};
      }
    `,
        resourcesBarCol: css `
      display: flex;
      flex-direction: column;
      margin-left: ${spacing.xl};
      width: 100%;
    `,
        nodesWrapper: css `
      margin-bottom: ${spacing.md};
      flex: 1 0 auto;
      max-width: 235px;
      div,
      label {
        white-space: nowrap;
        margin-left: ${spacing.md};
      }
    `,
        resourcesBar: css `
      margin-top: ${spacing.lg};
      margin-bottom: 67px;
      min-height: 75px;
    `,
        resourcesBarEmpty: css `
      margin-top: ${spacing.lg};
      margin-bottom: 78px;
      min-height: 75px;
    `,
        resourcesBarLast: css `
      margin-top: ${spacing.lg};
    `,
        resourcesInfoWrapper: css `
      display: flex;
      align-items: center;
      padding: ${spacing.sm};
      width: fit-content;
    `,
        resourcesInfoIcon: css `
      margin-right: ${spacing.sm};
    `,
        resourcesRadioWrapper: css `
      align-items: center;
      display: flex;
      justify-content: space-between;
      width: 760px;
    `,
        line: css `
      display: flex;
      gap: ${spacing.lg};
      > div {
        flex: 0 1 auto;
        width: 100%;
      }
    `,
        resourcesRadioBtnGroup: css `
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
//# sourceMappingURL=DBClusterAdvancedOptions.styles.js.map