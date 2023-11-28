import { css } from '@emotion/css';
export const getStyles = ({ palette, spacing, typography }) => ({
    progressBarWrapper: css `
    display: flex;
    flex-direction: column;
    width: 100%;
  `,
    labelWrapper: css `
    align-items: baseline;
    display: flex;
    justify-content: flex-start;
    margin-bottom: ${spacing.xs};
  `,
    stepsLabel: css `
    color: ${palette.blue80};
    font-weight: ${typography.weight.bold};
    margin-right: ${spacing.sm};
  `,
    stepsLabelError: css `
    color: ${palette.orange};
    label: error;
  `,
    message: css `
    font-size: ${typography.size.sm};
  `,
    progressBarBackground: css `
    background-color: ${palette.gray1};
    border-radius: 50px;
    height: ${spacing.sm};
    width: 100%;
  `,
    getFillerStyles: (width) => css `
    background-color: ${palette.blue80};
    border-radius: inherit;
    height: 100%;
    transition: width 300ms ease-in-out;
    width: ${width}%;
  `,
    progressBarError: css `
    background-color: ${palette.orange};
    label: error;
  `,
});
//# sourceMappingURL=ProgressBar.styles.js.map