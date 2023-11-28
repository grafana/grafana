import { css } from '@emotion/css';
const expectedColor = '#043464';
export const getStyles = ({ colors, palette, spacing, typography }) => ({
    resourcesBarWrapper: css `
    display: flex;
    flex-direction: row;
  `,
    iconWrapper: css `
    margin-right: ${spacing.sm};
  `,
    resourcesBarContent: css `
    display: flex;
    flex: 1;
    flex-direction: column;
  `,
    resourcesBarBackground: css `
    background-color: ${palette.gray1};
    border-radius: 50px;
    height: ${spacing.sm};
    position: relative;
    width: 100%;
  `,
    resourcesBarLabel: css `
    color: ${colors.textSemiWeak};
    font-size: ${typography.size.sm};
    margin-top: ${spacing.xs};
  `,
    captionWrapper: css `
    align-items: center;
    display: flex;
    margin-top: ${spacing.xs};
    max-height: ${typography.size.lg};
  `,
    captionSquare: css `
    width: 10px;
    height: 10px;
  `,
    allocatedSquare: css `
    background-color: ${palette.blue80};
  `,
    expectedSquare: css `
    background-color: ${expectedColor};
  `,
    expectedAllocatedSquare: css `
    background-color: ${palette.greenBase};
  `,
    captionLabel: css `
    color: ${colors.textSemiWeak};
    font-size: ${typography.size.sm};
    margin-left: ${spacing.sm};
  `,
    filled: css `
    border-radius: inherit;
    height: 100%;
    position: absolute;
    transition: width 300ms ease-in-out;
  `,
    filledAllocated: css `
    background-color: ${palette.blue80};
  `,
    filledExpected: css `
    background-color: ${expectedColor};
  `,
    filledExpectedAllocated: css `
    background-color: ${palette.greenBase};
  `,
    filledInsufficient: css `
    background-color: ${palette.brandDanger};
  `,
    insufficientIcon: css `
    color: ${palette.brandDanger};
  `,
    getFilledStyles: (width) => css `
    width: ${width}%;
  `,
});
//# sourceMappingURL=ResourcesBar.styles.js.map