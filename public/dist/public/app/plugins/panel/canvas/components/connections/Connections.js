import React from 'react';
import { BehaviorSubject } from 'rxjs';
import { config } from '@grafana/runtime';
import { ConnectionPath } from 'app/features/canvas';
import { getConnections, isConnectionSource, isConnectionTarget } from '../../utils';
import { CONNECTION_ANCHOR_ALT, ConnectionAnchors, CONNECTION_ANCHOR_HIGHLIGHT_OFFSET } from './ConnectionAnchors';
import { ConnectionSVG } from './ConnectionSVG';
export class Connections {
    constructor(scene) {
        this.state = [];
        this.selection = new BehaviorSubject(undefined);
        this.select = (connection) => {
            if (connection === this.selection.value) {
                return;
            }
            this.selection.next(connection);
        };
        this.updateState = () => {
            const s = this.selection.value;
            this.state = getConnections(this.scene.byName);
            if (s) {
                for (let c of this.state) {
                    if (c.source === s.source && c.index === s.index) {
                        this.selection.next(c);
                        break;
                    }
                }
            }
        };
        this.setConnectionAnchorRef = (anchorElement) => {
            this.connectionAnchorDiv = anchorElement;
        };
        this.setConnectionSVGRef = (connectionSVG) => {
            this.connectionSVG = connectionSVG;
        };
        this.setConnectionLineRef = (connectionLine) => {
            this.connectionLine = connectionLine;
        };
        // Recursively find the first parent that is a canvas element
        this.findElementTarget = (element) => {
            let elementTarget = undefined;
            // Cap recursion at the scene level
            if (element === this.scene.div) {
                return undefined;
            }
            elementTarget = this.scene.findElementByTarget(element);
            if (!elementTarget && element.parentElement) {
                elementTarget = this.findElementTarget(element.parentElement);
            }
            return elementTarget;
        };
        this.handleMouseEnter = (event) => {
            var _a, _b, _c;
            if (!(event.target instanceof Element) || !this.scene.isEditingEnabled) {
                return;
            }
            let element = this.findElementTarget(event.target);
            if (!element) {
                console.log('no element');
                return;
            }
            if (this.isDrawingConnection) {
                this.connectionTarget = element;
            }
            else {
                this.connectionSource = element;
                if (!this.connectionSource) {
                    console.log('no connection source');
                    return;
                }
            }
            const elementBoundingRect = element.div.getBoundingClientRect();
            const parentBoundingRect = (_a = this.scene.div) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect();
            const relativeTop = elementBoundingRect.top - ((_b = parentBoundingRect === null || parentBoundingRect === void 0 ? void 0 : parentBoundingRect.top) !== null && _b !== void 0 ? _b : 0);
            const relativeLeft = elementBoundingRect.left - ((_c = parentBoundingRect === null || parentBoundingRect === void 0 ? void 0 : parentBoundingRect.left) !== null && _c !== void 0 ? _c : 0);
            if (this.connectionAnchorDiv) {
                this.connectionAnchorDiv.style.display = 'none';
                this.connectionAnchorDiv.style.display = 'block';
                this.connectionAnchorDiv.style.top = `${relativeTop}px`;
                this.connectionAnchorDiv.style.left = `${relativeLeft}px`;
                this.connectionAnchorDiv.style.height = `${elementBoundingRect.height}px`;
                this.connectionAnchorDiv.style.width = `${elementBoundingRect.width}px`;
            }
        };
        // Return boolean indicates if connection anchors were hidden or not
        this.handleMouseLeave = (event) => {
            // If mouse is leaving INTO the anchor image, don't remove div
            if (event.relatedTarget instanceof HTMLImageElement &&
                event.relatedTarget.getAttribute('alt') === CONNECTION_ANCHOR_ALT) {
                return false;
            }
            this.connectionTarget = undefined;
            this.connectionAnchorDiv.style.display = 'none';
            return true;
        };
        this.connectionListener = (event) => {
            event.preventDefault();
            if (!(this.connectionLine && this.scene.div && this.scene.div.parentElement)) {
                return;
            }
            const parentBoundingRect = this.scene.div.parentElement.getBoundingClientRect();
            const x = event.pageX - parentBoundingRect.x;
            const y = event.pageY - parentBoundingRect.y;
            this.connectionLine.setAttribute('x2', `${x}`);
            this.connectionLine.setAttribute('y2', `${y}`);
            const connectionLineX1 = this.connectionLine.x1.baseVal.value;
            const connectionLineY1 = this.connectionLine.y1.baseVal.value;
            if (!this.didConnectionLeaveHighlight) {
                const connectionLength = Math.hypot(x - connectionLineX1, y - connectionLineY1);
                if (connectionLength > CONNECTION_ANCHOR_HIGHLIGHT_OFFSET && this.connectionSVG) {
                    this.didConnectionLeaveHighlight = true;
                    this.connectionSVG.style.display = 'block';
                    this.isDrawingConnection = true;
                }
            }
            if (!event.buttons) {
                if (this.connectionSource && this.connectionSource.div && this.connectionSource.div.parentElement) {
                    const sourceRect = this.connectionSource.div.getBoundingClientRect();
                    const parentRect = this.connectionSource.div.parentElement.getBoundingClientRect();
                    const sourceVerticalCenter = sourceRect.top - parentRect.top + sourceRect.height / 2;
                    const sourceHorizontalCenter = sourceRect.left - parentRect.left + sourceRect.width / 2;
                    // Convert from DOM coords to connection coords
                    // TODO: Break this out into util function and add tests
                    const sourceX = (connectionLineX1 - sourceHorizontalCenter) / (sourceRect.width / 2);
                    const sourceY = (sourceVerticalCenter - connectionLineY1) / (sourceRect.height / 2);
                    let targetX;
                    let targetY;
                    let targetName;
                    if (this.connectionTarget && this.connectionTarget.div) {
                        const targetRect = this.connectionTarget.div.getBoundingClientRect();
                        const targetVerticalCenter = targetRect.top - parentRect.top + targetRect.height / 2;
                        const targetHorizontalCenter = targetRect.left - parentRect.left + targetRect.width / 2;
                        targetX = (x - targetHorizontalCenter) / (targetRect.width / 2);
                        targetY = (targetVerticalCenter - y) / (targetRect.height / 2);
                        targetName = this.connectionTarget.options.name;
                    }
                    else {
                        const parentVerticalCenter = parentRect.height / 2;
                        const parentHorizontalCenter = parentRect.width / 2;
                        targetX = (x - parentHorizontalCenter) / (parentRect.width / 2);
                        targetY = (parentVerticalCenter - y) / (parentRect.height / 2);
                    }
                    const connection = {
                        source: {
                            x: sourceX,
                            y: sourceY,
                        },
                        target: {
                            x: targetX,
                            y: targetY,
                        },
                        targetName: targetName,
                        color: {
                            fixed: config.theme2.colors.text.primary,
                        },
                        size: {
                            fixed: 2,
                            min: 1,
                            max: 10,
                        },
                        path: ConnectionPath.Straight,
                    };
                    const { options } = this.connectionSource;
                    if (!options.connections) {
                        options.connections = [];
                    }
                    if (this.didConnectionLeaveHighlight) {
                        this.connectionSource.options.connections = [...options.connections, connection];
                        this.connectionSource.onChange(this.connectionSource.options);
                    }
                }
                if (this.connectionSVG) {
                    this.connectionSVG.style.display = 'none';
                }
                if (this.scene.selecto && this.scene.selecto.rootContainer) {
                    this.scene.selecto.rootContainer.style.cursor = 'default';
                    this.scene.selecto.rootContainer.removeEventListener('mousemove', this.connectionListener);
                }
                this.isDrawingConnection = false;
                this.updateState();
                this.scene.save();
            }
        };
        this.handleConnectionDragStart = (selectedTarget, clientX, clientY) => {
            var _a, _b;
            this.scene.selecto.rootContainer.style.cursor = 'crosshair';
            if (this.connectionSVG && this.connectionLine && this.scene.div && this.scene.div.parentElement) {
                const connectionStartTargetBox = selectedTarget.getBoundingClientRect();
                const parentBoundingRect = this.scene.div.parentElement.getBoundingClientRect();
                const x = connectionStartTargetBox.x - parentBoundingRect.x + CONNECTION_ANCHOR_HIGHLIGHT_OFFSET;
                const y = connectionStartTargetBox.y - parentBoundingRect.y + CONNECTION_ANCHOR_HIGHLIGHT_OFFSET;
                const mouseX = clientX - parentBoundingRect.x;
                const mouseY = clientY - parentBoundingRect.y;
                this.connectionLine.setAttribute('x1', `${x}`);
                this.connectionLine.setAttribute('y1', `${y}`);
                this.connectionLine.setAttribute('x2', `${mouseX}`);
                this.connectionLine.setAttribute('y2', `${mouseY}`);
                this.didConnectionLeaveHighlight = false;
            }
            (_b = (_a = this.scene.selecto) === null || _a === void 0 ? void 0 : _a.rootContainer) === null || _b === void 0 ? void 0 : _b.addEventListener('mousemove', this.connectionListener);
        };
        this.onChange = (current, update) => {
            var _a, _b;
            const connections = (_b = (_a = current.source.options.connections) === null || _a === void 0 ? void 0 : _a.splice(0)) !== null && _b !== void 0 ? _b : [];
            connections[current.index] = update;
            current.source.onChange(Object.assign(Object.assign({}, current.source.options), { connections }));
            this.updateState();
        };
        // used for moveable actions
        this.connectionsNeedUpdate = (element) => {
            return isConnectionSource(element) || isConnectionTarget(element, this.scene.byName);
        };
        this.scene = scene;
        this.updateState();
    }
    render() {
        return (React.createElement(React.Fragment, null,
            React.createElement(ConnectionAnchors, { setRef: this.setConnectionAnchorRef, handleMouseLeave: this.handleMouseLeave }),
            React.createElement(ConnectionSVG, { setSVGRef: this.setConnectionSVGRef, setLineRef: this.setConnectionLineRef, scene: this.scene })));
    }
}
//# sourceMappingURL=Connections.js.map