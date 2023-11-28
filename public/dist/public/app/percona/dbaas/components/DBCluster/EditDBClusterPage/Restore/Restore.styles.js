import { css } from '@emotion/css';
export const getStyles = ({ spacing }) => ({
    line: css `
    display: flex;
    gap: ${spacing.lg};
    > div {
      flex: 1 0;
    }
  `,
    hiddenField: css `
    visibility: hidden;
  `,
    field: css `
    width: 50%;
    flex-shrink: 1;
  `,
    fieldSetSwitch: css `
    label {
      position: absolute;
    }
  `,
    fieldSetLabel: css `
    display: flex;
    align-items: center;
    column-gap: 10px;
  `,
    asyncSelect: css `
    svg {
      margin-bottom: ${spacing.xxs};
    }
  `,
});
//# sourceMappingURL=Restore.styles.js.map