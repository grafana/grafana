import { css } from '@emotion/css';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStyles2 } from '@grafana/ui';
import { config } from 'app/core/config';
let idCounter = 0;
const htmlElementTypes = ['input', 'textarea'];
export const ConnectionSVG = ({ setSVGRef, setLineRef, scene }) => {
    var _a;
    const styles = useStyles2(getStyles);
    const headId = Date.now() + '_' + idCounter++;
    const CONNECTION_LINE_ID = useMemo(() => `connectionLineId-${headId}`, [headId]);
    const EDITOR_HEAD_ID = useMemo(() => `editorHead-${headId}`, [headId]);
    const defaultArrowColor = config.theme2.colors.text.primary;
    const defaultArrowSize = 2;
    const [selectedConnection, setSelectedConnection] = useState(undefined);
    // Need to use ref to ensure state is not stale in event handler
    const selectedConnectionRef = useRef(selectedConnection);
    useEffect(() => {
        selectedConnectionRef.current = selectedConnection;
    });
    useEffect(() => {
        var _a, _b;
        if ((_a = scene.panel.context.instanceState) === null || _a === void 0 ? void 0 : _a.selectedConnection) {
            setSelectedConnection((_b = scene.panel.context.instanceState) === null || _b === void 0 ? void 0 : _b.selectedConnection);
        }
    }, [(_a = scene.panel.context.instanceState) === null || _a === void 0 ? void 0 : _a.selectedConnection]);
    const onKeyUp = (e) => {
        var _a;
        const target = e.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }
        if (htmlElementTypes.indexOf(target.nodeName.toLowerCase()) > -1) {
            return;
        }
        // Backspace (8) or delete (46)
        if (e.keyCode === 8 || e.keyCode === 46) {
            if (selectedConnectionRef.current && selectedConnectionRef.current.source) {
                selectedConnectionRef.current.source.options.connections =
                    (_a = selectedConnectionRef.current.source.options.connections) === null || _a === void 0 ? void 0 : _a.filter((connection) => { var _a; return connection !== ((_a = selectedConnectionRef.current) === null || _a === void 0 ? void 0 : _a.info); });
                selectedConnectionRef.current.source.onChange(selectedConnectionRef.current.source.options);
                setSelectedConnection(undefined);
                scene.connections.select(undefined);
                scene.connections.updateState();
                scene.save();
            }
        }
        else {
            // Prevent removing event listener if key is not delete
            return;
        }
        document.removeEventListener('keyup', onKeyUp);
        scene.selecto.rootContainer.removeEventListener('click', clearSelectedConnection);
    };
    const clearSelectedConnection = (event) => {
        const eventTarget = event.target;
        const shouldResetSelectedConnection = !(eventTarget instanceof SVGLineElement && eventTarget.id === CONNECTION_LINE_ID);
        if (shouldResetSelectedConnection) {
            setSelectedConnection(undefined);
            scene.connections.select(undefined);
        }
    };
    const selectConnection = (connection) => {
        if (scene.isEditingEnabled) {
            setSelectedConnection(connection);
            scene.connections.select(connection);
            document.addEventListener('keyup', onKeyUp);
            scene.selecto.rootContainer.addEventListener('click', clearSelectedConnection);
        }
    };
    // @TODO revisit, currently returning last row index for field
    const getRowIndex = (fieldName) => {
        var _a;
        if (fieldName) {
            const series = (_a = scene.context.getPanelData()) === null || _a === void 0 ? void 0 : _a.series[0];
            const field = series === null || series === void 0 ? void 0 : series.fields.find((f) => (f.name = fieldName));
            const data = field === null || field === void 0 ? void 0 : field.values;
            return data ? data.length - 1 : 0;
        }
        return 0;
    };
    // Figure out target and then target's relative coordinates drawing (if no target do parent)
    const renderConnections = () => {
        return scene.connections.state.map((v, idx) => {
            var _a, _b, _c, _d;
            const { source, target, info } = v;
            const sourceRect = (_a = source.div) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect();
            const parent = (_b = source.div) === null || _b === void 0 ? void 0 : _b.parentElement;
            const parentRect = parent === null || parent === void 0 ? void 0 : parent.getBoundingClientRect();
            if (!sourceRect || !parent || !parentRect) {
                return;
            }
            const sourceHorizontalCenter = sourceRect.left - parentRect.left + sourceRect.width / 2;
            const sourceVerticalCenter = sourceRect.top - parentRect.top + sourceRect.height / 2;
            // Convert from connection coords to DOM coords
            // TODO: Break this out into util function and add tests
            const x1 = sourceHorizontalCenter + (info.source.x * sourceRect.width) / 2;
            const y1 = sourceVerticalCenter - (info.source.y * sourceRect.height) / 2;
            let x2;
            let y2;
            if (info.targetName) {
                const targetRect = (_c = target.div) === null || _c === void 0 ? void 0 : _c.getBoundingClientRect();
                const targetHorizontalCenter = targetRect.left - parentRect.left + targetRect.width / 2;
                const targetVerticalCenter = targetRect.top - parentRect.top + targetRect.height / 2;
                x2 = targetHorizontalCenter + (info.target.x * targetRect.width) / 2;
                y2 = targetVerticalCenter - (info.target.y * targetRect.height) / 2;
            }
            else {
                const parentHorizontalCenter = parentRect.width / 2;
                const parentVerticalCenter = parentRect.height / 2;
                x2 = parentHorizontalCenter + (info.target.x * parentRect.width) / 2;
                y2 = parentVerticalCenter - (info.target.y * parentRect.height) / 2;
            }
            const isSelected = selectedConnection === v && scene.panel.context.instanceState.selectedConnection;
            const strokeColor = info.color ? scene.context.getColor(info.color).value() : defaultArrowColor;
            const lastRowIndex = getRowIndex((_d = info.size) === null || _d === void 0 ? void 0 : _d.field);
            const strokeWidth = info.size ? scene.context.getScale(info.size).get(lastRowIndex) : defaultArrowSize;
            const connectionCursorStyle = scene.isEditingEnabled ? 'grab' : '';
            const selectedStyles = { stroke: '#44aaff', strokeOpacity: 0.6, strokeWidth: strokeWidth + 5 };
            const CONNECTION_HEAD_ID = `connectionHead-${headId + Math.random()}`;
            return (React.createElement("svg", { className: styles.connection, key: idx },
                React.createElement("g", { onClick: () => selectConnection(v) },
                    React.createElement("defs", null,
                        React.createElement("marker", { id: CONNECTION_HEAD_ID, markerWidth: "10", markerHeight: "7", refX: "10", refY: "3.5", orient: "auto", stroke: strokeColor },
                            React.createElement("polygon", { points: "0 0, 10 3.5, 0 7", fill: strokeColor }))),
                    React.createElement("line", { id: `${CONNECTION_LINE_ID}_transparent`, cursor: connectionCursorStyle, pointerEvents: "auto", stroke: "transparent", strokeWidth: 15, style: isSelected ? selectedStyles : {}, x1: x1, y1: y1, x2: x2, y2: y2 }),
                    React.createElement("line", { id: CONNECTION_LINE_ID, stroke: strokeColor, pointerEvents: "auto", strokeWidth: strokeWidth, markerEnd: `url(#${CONNECTION_HEAD_ID})`, x1: x1, y1: y1, x2: x2, y2: y2, cursor: connectionCursorStyle }))));
        });
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("svg", { ref: setSVGRef, className: styles.editorSVG },
            React.createElement("defs", null,
                React.createElement("marker", { id: EDITOR_HEAD_ID, markerWidth: "10", markerHeight: "7", refX: "10", refY: "3.5", orient: "auto", stroke: defaultArrowColor },
                    React.createElement("polygon", { points: "0 0, 10 3.5, 0 7", fill: defaultArrowColor }))),
            React.createElement("line", { ref: setLineRef, stroke: defaultArrowColor, strokeWidth: 2, markerEnd: `url(#${EDITOR_HEAD_ID})` })),
        renderConnections()));
};
const getStyles = (theme) => ({
    editorSVG: css `
    position: absolute;
    pointer-events: none;
    width: 100%;
    height: 100%;
    z-index: 1000;
    display: none;
  `,
    connection: css `
    position: absolute;
    width: 100%;
    height: 100%;
    z-index: 1000;
    pointer-events: none;
  `,
});
//# sourceMappingURL=ConnectionSVG.js.map