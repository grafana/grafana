import { css, cx } from '@emotion/css';
import React, { useState } from 'react';
import { usePopper } from 'react-popper';
import { colorManipulator, getDisplayProcessor } from '@grafana/data';
import { useStyles2, useTheme2, Portal, DEFAULT_ANNOTATION_COLOR } from '@grafana/ui';
import { getCommonAnnotationStyles } from '../styles';
import { AnnotationEditorForm } from './AnnotationEditorForm';
export const AnnotationEditor = ({ onDismiss, onSave, timeZone, data, selection, annotation, style, }) => {
    const theme = useTheme2();
    const styles = useStyles2(getStyles);
    const commonStyles = useStyles2(getCommonAnnotationStyles);
    const [popperTrigger, setPopperTrigger] = useState(null);
    const [editorPopover, setEditorPopover] = useState(null);
    const popper = usePopper(popperTrigger, editorPopover, {
        modifiers: [
            { name: 'arrow', enabled: false },
            {
                name: 'preventOverflow',
                enabled: true,
                options: {
                    rootBoundary: 'viewport',
                },
            },
        ],
    });
    let xField = data.fields[0];
    if (!xField) {
        return null;
    }
    const xFieldFmt = xField.display || getDisplayProcessor({ field: xField, timeZone, theme });
    const isRegionAnnotation = selection.min !== selection.max;
    return (React.createElement(Portal, null,
        React.createElement(React.Fragment, null,
            React.createElement("div", { style: style },
                React.createElement("div", { className: cx(css `
                position: absolute;
                top: ${selection.bbox.top}px;
                left: ${selection.bbox.left}px;
                width: ${selection.bbox.width}px;
                height: ${selection.bbox.height}px;
              `, isRegionAnnotation ? styles.overlayRange(annotation) : styles.overlay(annotation)) },
                    React.createElement("div", { ref: setPopperTrigger, className: isRegionAnnotation
                            ? cx(commonStyles(annotation).markerBar, styles.markerBar)
                            : cx(commonStyles(annotation).markerTriangle, styles.markerTriangle) }))),
            React.createElement(AnnotationEditorForm, Object.assign({ annotation: annotation || { time: selection.min, timeEnd: selection.max }, timeFormatter: (v) => xFieldFmt(v).text, onSave: onSave, onDismiss: onDismiss, ref: setEditorPopover, style: popper.styles.popper }, popper.attributes.popper)))));
};
const getStyles = (theme) => {
    return {
        overlay: (annotation) => {
            const color = theme.visualization.getColorByName((annotation === null || annotation === void 0 ? void 0 : annotation.color) || DEFAULT_ANNOTATION_COLOR);
            return css `
        border-left: 1px dashed ${color};
      `;
        },
        overlayRange: (annotation) => {
            const color = theme.visualization.getColorByName((annotation === null || annotation === void 0 ? void 0 : annotation.color) || DEFAULT_ANNOTATION_COLOR);
            return css `
        background: ${colorManipulator.alpha(color, 0.1)};
        border-left: 1px dashed ${color};
        border-right: 1px dashed ${color};
      `;
        },
        markerTriangle: css `
      top: calc(100% + 2px);
      left: -4px;
      position: absolute;
    `,
        markerBar: css `
      top: 100%;
      left: 0;
      position: absolute;
    `,
    };
};
//# sourceMappingURL=AnnotationEditor.js.map