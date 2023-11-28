import { css } from '@emotion/css';
export const getStyles = ({ spacing, typography }) => ({
    availableUpdate: css `
    align-items: flex-start;
    display: flex;
    font-weight: ${typography.weight.bold};
    justify-content: flex-start;
    line-height: ${typography.lineHeight.sm};
    margin-top: ${spacing.xs};

    > div {
      display: flex;
    }

    a {
      margin: 0;
    }
  `,
    whatsNewLink: css `
    height: 1em;
    margin-top: ${spacing.xs};
    padding: 0;
  `,
    releaseDate: css `
    font-size: ${typography.size.sm};
    font-weight: ${typography.weight.regular};
  `,
    latestVersion: css `
    margin-right: ${spacing.xs};
  `,
    infoIcon: css `
    margin-left: ${spacing.xs};
    margin-right: ${spacing.sm};
  `,
});
//# sourceMappingURL=AvailableUpdate.styles.js.map