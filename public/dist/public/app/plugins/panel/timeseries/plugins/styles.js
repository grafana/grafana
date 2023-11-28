import { css } from '@emotion/css';
import { DEFAULT_ANNOTATION_COLOR } from '@grafana/ui';
export const getCommonAnnotationStyles = (theme) => {
    return (annotation) => {
        const color = theme.visualization.getColorByName((annotation === null || annotation === void 0 ? void 0 : annotation.color) || DEFAULT_ANNOTATION_COLOR);
        return {
            markerTriangle: css `
        width: 0;
        height: 0;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-bottom: 4px solid ${color};
      `,
            markerBar: css `
        display: block;
        width: calc(100%);
        height: 5px;
        background: ${color};
      `,
        };
    };
};
//# sourceMappingURL=styles.js.map