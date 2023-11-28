import { css } from '@emotion/css';
export const getStyles = ({ v1: { spacing, palette }, typography }) => ({
    widgetWrapper: css `
    min-height: 200px;
    background-color: ${palette.gray15};
    border-radius: 10px;
    padding: ${spacing.lg};
    display: flex;
    flex-direction: column;
  `,
    widgetTitle: css `
    font-size: ${typography.h4.fontSize};
    font-weight: ${typography.h4.fontWeight};
  `,
    wrapper: css `
    flex: 50%;
    max-width: 50%;
    padding: ${spacing.sm} ${spacing.md};
  `,
});
//# sourceMappingURL=WidgetWrapper.styles.js.map