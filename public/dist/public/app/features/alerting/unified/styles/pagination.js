import { css } from '@emotion/css';
export const getPaginationStyles = (theme) => {
    return css `
    float: none;
    display: flex;
    justify-content: flex-start;
    margin: ${theme.spacing(2, 0)};
  `;
};
//# sourceMappingURL=pagination.js.map