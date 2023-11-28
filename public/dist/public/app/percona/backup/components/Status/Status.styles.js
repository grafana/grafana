import { css } from '@emotion/css';
import { stylesFactory } from '@grafana/ui';
import { successfulStates } from './Status.constants';
export const getStyles = stylesFactory(({ v1: { palette } }, status) => ({
    statusContainer: css `
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
  `,
    ellipsisContainer: css `
    display: table;
    width: 15px;
  `,
    statusIcon: css `
    color: ${successfulStates.includes(status) ? palette.greenBase : palette.redBase};
  `,
    logs: css `
    color: ${palette.blue77};
    text-decoration: underline;
    cursor: pointer;
  `,
}));
//# sourceMappingURL=Status.styles.js.map