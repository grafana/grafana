import { css } from '@emotion/css';
export const getStyles = ({ v1: { breakpoints, colors }, spacing }) => ({
    titles: css `
    margin-bottom: ${spacing(4)};
  `,
    serverDetails: css `
    display: flex;

    & > div {
      flex: 1;

      &:first-child {
        margin-right: ${spacing(2)};
      }
    }
  `,
    form: css `
    max-width: 500px;
    min-width: 150px;
    width: 100%;
  `,
    accessTokenRow: css `
    display: flex;
    align-items: center;

    & > div {
      flex: 0 1 80%;
    }

    & > a {
      color: ${colors.linkExternal};
      flex: 1;
      text-align: right;
    }
  `,
    connectionTitle: css `
    margin-top: ${spacing(4)};
  `,
    getTokenAnchor: css `
    // To match input height
    height: 38px;
    margin-top: -7px;

    & > button {
      height: 100%;
    }
  `,
    submitButton: css `
    padding-left: 50px;
    padding-right: 50px;
    margin-bottom: ${spacing(1)};

    @media (max-width: ${breakpoints.md}) {
      display: flex;
      justify-content: center;
      width: 100%;
    }
  `,
});
//# sourceMappingURL=Connect.styles.js.map