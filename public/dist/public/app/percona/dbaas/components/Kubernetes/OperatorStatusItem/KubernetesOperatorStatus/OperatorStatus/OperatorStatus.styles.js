import { css } from '@emotion/css';
import tinycolor from 'tinycolor2';
export const getStyles = ({ v1, isDark }) => {
    const sourceColor = v1.palette.gray1;
    let borderColor;
    let bgColor;
    let textColor;
    if (isDark) {
        bgColor = tinycolor(sourceColor).setAlpha(0.15).toString();
        borderColor = tinycolor(sourceColor).darken(30).toString();
        textColor = tinycolor(sourceColor).lighten(15).toString();
    }
    else {
        bgColor = tinycolor(sourceColor).setAlpha(0.15).toString();
        borderColor = tinycolor(sourceColor).lighten(20).toString();
        textColor = tinycolor(sourceColor).darken(15).toString();
    }
    return {
        wrapperGrey: css `
      background: ${bgColor};
      border: 1px solid ${borderColor};
      color: ${textColor};
    `,
        versionAvailable: css `
      margin-left: ${v1.spacing.xs};
    `,
    };
};
//# sourceMappingURL=OperatorStatus.styles.js.map