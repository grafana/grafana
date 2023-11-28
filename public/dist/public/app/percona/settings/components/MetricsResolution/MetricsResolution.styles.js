import { css } from '@emotion/css';
export const getStyles = ({ v1: { spacing } }) => ({
    resolutionsWrapper: css `
    display: flex;
    flex-direction: column;
  `,
    resolutionsRadioButtonGroup: css `
    padding: ${spacing.lg} 0 ${spacing.xl} 0;
  `,
    resolutionInput: css `
    input {
      width: 60px;
    }
  `,
    numericFieldWrapper: css `
    width: 100px;
    white-space: nowrap;
  `,
});
//# sourceMappingURL=MetricsResolution.styles.js.map