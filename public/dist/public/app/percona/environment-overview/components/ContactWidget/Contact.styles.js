import { css } from '@emotion/css';
export const getStyles = ({ v1: { spacing }, typography, colors }) => ({
    nameWrapper: css `
    display: flex;
    align-items: center;
    padding: ${spacing.sm} 0;
  `,
    name: css `
    margin-left: ${spacing.xs};
    margin-right: ${spacing.md};
  `,
    contactTitle: css `
    font-size: ${typography.h5.fontSize};
    font-weight: ${typography.h5.fontWeight};
  `,
    clipboardButton: css `
    padding: 0;
    background-color: transparent;
    color: ${colors.primary.text};
    :hover {
      background-color: transparent;
    }
  `,
});
//# sourceMappingURL=Contact.styles.js.map