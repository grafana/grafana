import { css } from '@emotion/css';
import { stylesFactory } from '@grafana/ui';
export const getStyles = stylesFactory(({ spacing, typography, border, colors, palette }) => {
    return {
        labelWrapper: css `
      position: absolute;
      top: 24px;
      right: 24px;

      h1 {
        font-size: ${typography.size.md};
        color: ${colors.textWeak};
        padding: 5px ${spacing.sm} 5px ${spacing.sm};
        ${border.width.sm} solid ${colors.pageHeaderBorder};
        border-radius: ${border.radius.md};
        user-select: none;
      }
    `,
        link: css `
      color: ${colors.linkExternal};
    `,
    };
});
//# sourceMappingURL=TechnicalPreview.styles.js.map