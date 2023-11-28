import { css } from '@emotion/css';
export const getStyles = ({ v1: { palette } }) => ({
    labelWrapper: css `
    display: flex;
    justify-content: space-between;
    width: 100%;
  `,
    label: css `
    display: flex;
    align-items: center;
    color: ${palette.blue85};
    font-size: 12px;
  `,
});
//# sourceMappingURL=SectionLabel.styles.js.map