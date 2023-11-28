import { css } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';
import Draggable from 'react-draggable';
import { Resizable } from 'react-resizable';
import { IconButton, Portal, useStyles2 } from '@grafana/ui';
import store from 'app/core/store';
import { InlineEditBody } from './InlineEditBody';
const OFFSET_X = 10;
const OFFSET_Y = 32;
export function InlineEdit({ onClose, id, scene }) {
    var _a, _b, _c, _d;
    const root = (_a = scene.root.div) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const ref = useRef(null);
    const styles = useStyles2(getStyles);
    const inlineEditKey = 'inlineEditPanel' + id.toString();
    const defaultMeasurements = { width: 400, height: 400 };
    const widthOffset = (_b = root === null || root === void 0 ? void 0 : root.width) !== null && _b !== void 0 ? _b : defaultMeasurements.width + OFFSET_X * 2;
    const defaultX = (_c = root === null || root === void 0 ? void 0 : root.x) !== null && _c !== void 0 ? _c : 0 + widthOffset - defaultMeasurements.width - OFFSET_X;
    const defaultY = (_d = root === null || root === void 0 ? void 0 : root.y) !== null && _d !== void 0 ? _d : 0 + OFFSET_Y;
    const savedPlacement = store.getObject(inlineEditKey, {
        x: defaultX,
        y: defaultY,
        w: defaultMeasurements.width,
        h: defaultMeasurements.height,
    });
    const [measurements, setMeasurements] = useState({ width: savedPlacement.w, height: savedPlacement.h });
    const [placement, setPlacement] = useState({ x: savedPlacement.x, y: savedPlacement.y });
    // Checks that placement is within browser window
    useEffect(() => {
        const minX = windowWidth - measurements.width - OFFSET_X;
        const minY = windowHeight - measurements.height - OFFSET_Y;
        if (minX < placement.x && minX > 0) {
            setPlacement(Object.assign(Object.assign({}, placement), { x: minX }));
        }
        if (minY < placement.y && minY > 0) {
            setPlacement(Object.assign(Object.assign({}, placement), { y: minY }));
        }
    }, [windowHeight, windowWidth, placement, measurements]);
    const onDragStop = (event, dragElement) => {
        let x = dragElement.x < 0 ? 0 : dragElement.x;
        let y = dragElement.y < 0 ? 0 : dragElement.y;
        setPlacement({ x: x, y: y });
        saveToStore(x, y, measurements.width, measurements.height);
    };
    const onResizeStop = (event, data) => {
        const { size } = data;
        setMeasurements({ width: size.width, height: size.height });
        saveToStore(placement.x, placement.y, size.width, size.height);
    };
    const saveToStore = (x, y, width, height) => {
        store.setObject(inlineEditKey, { x: x, y: y, w: width, h: height });
    };
    return (React.createElement(Portal, null,
        React.createElement("div", { className: styles.draggableWrapper },
            React.createElement(Draggable, { handle: "strong", onStop: onDragStop, position: { x: placement.x, y: placement.y } },
                React.createElement(Resizable, { height: measurements.height, width: measurements.width, onResize: onResizeStop },
                    React.createElement("div", { className: styles.inlineEditorContainer, style: { height: `${measurements.height}px`, width: `${measurements.width}px` }, ref: ref },
                        React.createElement("strong", { className: styles.inlineEditorHeader },
                            React.createElement("div", { className: styles.placeholder }),
                            React.createElement("div", null, "Canvas Inline Editor"),
                            React.createElement(IconButton, { name: "times", size: "xl", className: styles.inlineEditorClose, onClick: onClose, tooltip: "Close inline editor" })),
                        React.createElement("div", { className: styles.inlineEditorContentWrapper },
                            React.createElement("div", { className: styles.inlineEditorContent },
                                React.createElement(InlineEditBody, null)))))))));
}
const getStyles = (theme) => ({
    inlineEditorContainer: css `
    display: flex;
    flex-direction: column;
    background: ${theme.components.panel.background};
    border: 1px solid ${theme.colors.border.weak};
    box-shadow: ${theme.shadows.z3};
    z-index: 1000;
    opacity: 1;
    min-width: 400px;
  `,
    draggableWrapper: css `
    width: 0;
    height: 0;
  `,
    inlineEditorHeader: css `
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${theme.colors.background.canvas};
    border-bottom: 1px solid ${theme.colors.border.weak};
    height: 40px;
    cursor: move;
  `,
    inlineEditorContent: css `
    white-space: pre-wrap;
    padding: 10px;
  `,
    inlineEditorClose: css `
    margin-left: auto;
  `,
    placeholder: css `
    width: 24px;
    height: 24px;
    visibility: hidden;
    margin-right: auto;
  `,
    inlineEditorContentWrapper: css `
    overflow: scroll;
  `,
});
//# sourceMappingURL=InlineEdit.js.map