import { css } from '@emotion/css';
import Moveable from 'moveable';
import React from 'react';
import { BehaviorSubject, ReplaySubject, Subject } from 'rxjs';
import { first } from 'rxjs/operators';
import Selecto from 'selecto';
import { AppEvents } from '@grafana/data';
import { locationService } from '@grafana/runtime/src';
import { Portal, stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
import { DEFAULT_CANVAS_ELEMENT_CONFIG } from 'app/features/canvas';
import { getColorDimensionFromData, getResourceDimensionFromData, getScalarDimensionFromData, getScaleDimensionFromData, getTextDimensionFromData, } from 'app/features/dimensions/utils';
import { CanvasContextMenu } from 'app/plugins/panel/canvas/components/CanvasContextMenu';
import { CanvasTooltip } from 'app/plugins/panel/canvas/components/CanvasTooltip';
import { CONNECTION_ANCHOR_DIV_ID } from 'app/plugins/panel/canvas/components/connections/ConnectionAnchors';
import { Connections } from 'app/plugins/panel/canvas/components/connections/Connections';
import { LayerActionID } from 'app/plugins/panel/canvas/types';
import appEvents from '../../../core/app_events';
import { HorizontalConstraint, VerticalConstraint } from '../types';
import { constraintViewable, dimensionViewable, settingsViewable } from './ables';
import { FrameState } from './frame';
import { RootElement } from './root';
export class Scene {
    constructor(cfg, enableEditing, showAdvancedTypes, onSave, panel) {
        this.onSave = onSave;
        this.styles = getStyles(config.theme2);
        this.selection = new ReplaySubject(1);
        this.moved = new Subject(); // called after resize/drag for editor updates
        this.byName = new Map();
        this.revId = 0;
        this.width = 0;
        this.height = 0;
        this.style = {};
        this.skipNextSelectionBroadcast = false;
        this.ignoreDataUpdate = false;
        this.isPanelEditing = locationService.getSearchObject().editPanel !== undefined;
        this.editModeEnabled = new BehaviorSubject(false);
        this.targetsToSelect = new Set();
        this.getNextElementName = (isFrame = false) => {
            const label = isFrame ? 'Frame' : 'Element';
            let idx = this.byName.size + 1;
            const max = idx + 100;
            while (true && idx < max) {
                const name = `${label} ${idx++}`;
                if (!this.byName.has(name)) {
                    return name;
                }
            }
            return `${label} ${Date.now()}`;
        };
        this.canRename = (v) => {
            return !this.byName.has(v);
        };
        this.context = {
            getColor: (color) => getColorDimensionFromData(this.data, color),
            getScale: (scale) => getScaleDimensionFromData(this.data, scale),
            getScalar: (scalar) => getScalarDimensionFromData(this.data, scalar),
            getText: (text) => getTextDimensionFromData(this.data, text),
            getResource: (res) => getResourceDimensionFromData(this.data, res),
            getPanelData: () => this.data,
        };
        this.generateFrameContainer = (elements) => {
            let minTop = Infinity;
            let minLeft = Infinity;
            let maxRight = 0;
            let maxBottom = 0;
            elements.forEach((element) => {
                var _a;
                const elementContainer = (_a = element.div) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect();
                if (!elementContainer) {
                    return;
                }
                if (minTop > elementContainer.top) {
                    minTop = elementContainer.top;
                }
                if (minLeft > elementContainer.left) {
                    minLeft = elementContainer.left;
                }
                if (maxRight < elementContainer.right) {
                    maxRight = elementContainer.right;
                }
                if (maxBottom < elementContainer.bottom) {
                    maxBottom = elementContainer.bottom;
                }
            });
            return {
                top: minTop,
                left: minLeft,
                width: maxRight - minLeft,
                height: maxBottom - minTop,
            };
        };
        this.save = (updateMoveable = false) => {
            this.onSave(this.root.getSaveModel());
            if (updateMoveable) {
                setTimeout(() => {
                    if (this.div) {
                        this.initMoveable(true, this.isEditingEnabled);
                    }
                });
            }
        };
        this.findElementByTarget = (target) => {
            // We will probably want to add memoization to this as we are calling on drag / resize
            const stack = [...this.root.elements];
            while (stack.length > 0) {
                const currentElement = stack.shift();
                if (currentElement && currentElement.div && currentElement.div === target) {
                    return currentElement;
                }
                const nestedElements = currentElement instanceof FrameState ? currentElement.elements : [];
                for (const nestedElement of nestedElements) {
                    stack.unshift(nestedElement);
                }
            }
            return undefined;
        };
        this.setNonTargetPointerEvents = (target, disablePointerEvents) => {
            const stack = [...this.root.elements];
            while (stack.length > 0) {
                const currentElement = stack.shift();
                if (currentElement && currentElement.div && currentElement.div !== target) {
                    currentElement.applyLayoutStylesToDiv(disablePointerEvents);
                }
                const nestedElements = currentElement instanceof FrameState ? currentElement.elements : [];
                for (const nestedElement of nestedElements) {
                    stack.unshift(nestedElement);
                }
            }
        };
        this.setRef = (sceneContainer) => {
            this.div = sceneContainer;
        };
        this.select = (selection) => {
            if (this.selecto) {
                this.selecto.setSelectedTargets(selection.targets);
                this.updateSelection(selection);
                this.editModeEnabled.next(false);
                // Hide connection anchors on programmatic select
                if (this.connections.connectionAnchorDiv) {
                    this.connections.connectionAnchorDiv.style.display = 'none';
                }
            }
        };
        this.updateSelection = (selection) => {
            this.moveable.target = selection.targets;
            if (this.skipNextSelectionBroadcast) {
                this.skipNextSelectionBroadcast = false;
                return;
            }
            if (selection.frame) {
                this.selection.next([selection.frame]);
            }
            else {
                const s = selection.targets.map((t) => this.findElementByTarget(t));
                this.selection.next(s);
            }
        };
        this.generateTargetElements = (rootElements) => {
            let targetElements = [];
            const stack = [...rootElements];
            while (stack.length > 0) {
                const currentElement = stack.shift();
                if (currentElement && currentElement.div) {
                    targetElements.push(currentElement.div);
                }
                const nestedElements = currentElement instanceof FrameState ? currentElement.elements : [];
                for (const nestedElement of nestedElements) {
                    stack.unshift(nestedElement);
                }
            }
            return targetElements;
        };
        this.initMoveable = (destroySelecto = false, allowChanges = true) => {
            const targetElements = this.generateTargetElements(this.root.elements);
            if (destroySelecto && this.selecto) {
                this.selecto.destroy();
            }
            this.selecto = new Selecto({
                container: this.div,
                rootContainer: this.div,
                selectableTargets: targetElements,
                toggleContinueSelect: 'shift',
                selectFromInside: false,
                hitRate: 0,
            });
            this.moveable = new Moveable(this.div, {
                draggable: allowChanges && !this.editModeEnabled.getValue(),
                resizable: allowChanges,
                ables: [dimensionViewable, constraintViewable(this), settingsViewable(this)],
                props: {
                    dimensionViewable: allowChanges,
                    constraintViewable: allowChanges,
                    settingsViewable: allowChanges,
                },
                origin: false,
                className: this.styles.selected,
            })
                .on('click', (event) => {
                var _a;
                const targetedElement = this.findElementByTarget(event.target);
                let elementSupportsEditing = false;
                if (targetedElement) {
                    elementSupportsEditing = (_a = targetedElement.item.hasEditMode) !== null && _a !== void 0 ? _a : false;
                }
                if (event.isDouble && allowChanges && !this.editModeEnabled.getValue() && elementSupportsEditing) {
                    this.editModeEnabled.next(true);
                }
            })
                .on('clickGroup', (event) => {
                this.selecto.clickTarget(event.inputEvent, event.inputTarget);
            })
                .on('dragStart', (event) => {
                this.ignoreDataUpdate = true;
                this.setNonTargetPointerEvents(event.target, true);
            })
                .on('dragGroupStart', (event) => {
                this.ignoreDataUpdate = true;
            })
                .on('drag', (event) => {
                const targetedElement = this.findElementByTarget(event.target);
                if (targetedElement) {
                    targetedElement.applyDrag(event);
                    if (this.connections.connectionsNeedUpdate(targetedElement) && this.moveableActionCallback) {
                        this.moveableActionCallback(true);
                    }
                }
            })
                .on('dragGroup', (e) => {
                let needsUpdate = false;
                for (let event of e.events) {
                    const targetedElement = this.findElementByTarget(event.target);
                    if (targetedElement) {
                        targetedElement.applyDrag(event);
                        if (!needsUpdate) {
                            needsUpdate = this.connections.connectionsNeedUpdate(targetedElement);
                        }
                    }
                }
                if (needsUpdate && this.moveableActionCallback) {
                    this.moveableActionCallback(true);
                }
            })
                .on('dragGroupEnd', (e) => {
                e.events.forEach((event) => {
                    const targetedElement = this.findElementByTarget(event.target);
                    if (targetedElement) {
                        targetedElement.setPlacementFromConstraint();
                    }
                });
                this.moved.next(Date.now());
                this.ignoreDataUpdate = false;
            })
                .on('dragEnd', (event) => {
                const targetedElement = this.findElementByTarget(event.target);
                if (targetedElement) {
                    targetedElement.setPlacementFromConstraint();
                }
                this.moved.next(Date.now());
                this.ignoreDataUpdate = false;
                this.setNonTargetPointerEvents(event.target, false);
            })
                .on('resizeStart', (event) => {
                const targetedElement = this.findElementByTarget(event.target);
                if (targetedElement) {
                    targetedElement.tempConstraint = Object.assign({}, targetedElement.options.constraint);
                    targetedElement.options.constraint = {
                        vertical: VerticalConstraint.Top,
                        horizontal: HorizontalConstraint.Left,
                    };
                    targetedElement.setPlacementFromConstraint();
                }
            })
                .on('resize', (event) => {
                const targetedElement = this.findElementByTarget(event.target);
                if (targetedElement) {
                    targetedElement.applyResize(event);
                    if (this.connections.connectionsNeedUpdate(targetedElement) && this.moveableActionCallback) {
                        this.moveableActionCallback(true);
                    }
                }
                this.moved.next(Date.now()); // TODO only on end
            })
                .on('resizeGroup', (e) => {
                let needsUpdate = false;
                for (let event of e.events) {
                    const targetedElement = this.findElementByTarget(event.target);
                    if (targetedElement) {
                        targetedElement.applyResize(event);
                        if (!needsUpdate) {
                            needsUpdate = this.connections.connectionsNeedUpdate(targetedElement);
                        }
                    }
                }
                if (needsUpdate && this.moveableActionCallback) {
                    this.moveableActionCallback(true);
                }
                this.moved.next(Date.now()); // TODO only on end
            })
                .on('resizeEnd', (event) => {
                const targetedElement = this.findElementByTarget(event.target);
                if (targetedElement) {
                    if (targetedElement.tempConstraint) {
                        targetedElement.options.constraint = targetedElement.tempConstraint;
                        targetedElement.tempConstraint = undefined;
                    }
                    targetedElement.setPlacementFromConstraint();
                }
            });
            let targets = [];
            this.selecto.on('dragStart', (event) => {
                var _a, _b;
                const selectedTarget = event.inputEvent.target;
                // If selected target is a connection control, eject to handle connection event
                if (selectedTarget.id === CONNECTION_ANCHOR_DIV_ID) {
                    this.connections.handleConnectionDragStart(selectedTarget, event.inputEvent.clientX, event.inputEvent.clientY);
                    event.stop();
                    return;
                }
                const isTargetMoveableElement = this.moveable.isMoveableElement(selectedTarget) ||
                    targets.some((target) => target === selectedTarget || target.contains(selectedTarget));
                const isTargetAlreadySelected = (_a = this.selecto) === null || _a === void 0 ? void 0 : _a.getSelectedTargets().includes(selectedTarget.parentElement.parentElement);
                // Apply grabbing cursor while dragging, applyLayoutStylesToDiv() resets it to grab when done
                if (this.isEditingEnabled &&
                    !this.editModeEnabled.getValue() &&
                    isTargetMoveableElement &&
                    ((_b = this.selecto) === null || _b === void 0 ? void 0 : _b.getSelectedTargets().length)) {
                    this.selecto.getSelectedTargets()[0].style.cursor = 'grabbing';
                }
                if (isTargetMoveableElement || isTargetAlreadySelected || !this.isEditingEnabled) {
                    // Prevent drawing selection box when selected target is a moveable element or already selected
                    event.stop();
                }
            })
                .on('select', () => {
                this.editModeEnabled.next(false);
                // Hide connection anchors on select
                if (this.connections.connectionAnchorDiv) {
                    this.connections.connectionAnchorDiv.style.display = 'none';
                }
            })
                .on('selectEnd', (event) => {
                var _a;
                targets = event.selected;
                this.updateSelection({ targets });
                if (event.isDragStart) {
                    if (this.isEditingEnabled && !this.editModeEnabled.getValue() && ((_a = this.selecto) === null || _a === void 0 ? void 0 : _a.getSelectedTargets().length)) {
                        this.selecto.getSelectedTargets()[0].style.cursor = 'grabbing';
                    }
                    event.inputEvent.preventDefault();
                    event.data.timer = setTimeout(() => {
                        this.moveable.dragStart(event.inputEvent);
                    });
                }
            })
                .on('dragEnd', (event) => {
                clearTimeout(event.data.timer);
            });
        };
        this.reorderElements = (src, dest, dragToGap, destPosition) => {
            var _a, _b, _c;
            switch (dragToGap) {
                case true:
                    switch (destPosition) {
                        case -1:
                            // top of the tree
                            if (src.parent instanceof FrameState) {
                                // move outside the frame
                                if (dest.parent) {
                                    this.updateElements(src, dest.parent, dest.parent.elements.length);
                                    src.updateData(dest.parent.scene.context);
                                }
                            }
                            else {
                                (_a = dest.parent) === null || _a === void 0 ? void 0 : _a.reorderTree(src, dest, true);
                            }
                            break;
                        default:
                            if (dest.parent) {
                                this.updateElements(src, dest.parent, dest.parent.elements.indexOf(dest));
                                src.updateData(dest.parent.scene.context);
                            }
                            break;
                    }
                    break;
                case false:
                    if (dest instanceof FrameState) {
                        if (src.parent === dest) {
                            // same frame parent
                            (_b = src.parent) === null || _b === void 0 ? void 0 : _b.reorderTree(src, dest, true);
                        }
                        else {
                            this.updateElements(src, dest);
                            src.updateData(dest.scene.context);
                        }
                    }
                    else if (src.parent === dest.parent) {
                        (_c = src.parent) === null || _c === void 0 ? void 0 : _c.reorderTree(src, dest);
                    }
                    else {
                        if (dest.parent) {
                            this.updateElements(src, dest.parent);
                            src.updateData(dest.parent.scene.context);
                        }
                    }
                    break;
            }
        };
        this.updateElements = (src, dest, idx = null) => {
            var _a, _b, _c;
            (_a = src.parent) === null || _a === void 0 ? void 0 : _a.doAction(LayerActionID.Delete, src);
            src.parent = dest;
            const elementContainer = (_b = src.div) === null || _b === void 0 ? void 0 : _b.getBoundingClientRect();
            src.setPlacementFromConstraint(elementContainer, (_c = dest.div) === null || _c === void 0 ? void 0 : _c.getBoundingClientRect());
            const destIndex = idx !== null && idx !== void 0 ? idx : dest.elements.length - 1;
            dest.elements.splice(destIndex, 0, src);
            dest.scene.save();
            dest.reinitializeMoveable();
        };
        this.addToSelection = () => {
            try {
                let selection = { targets: [] };
                selection.targets = [...this.targetsToSelect];
                this.select(selection);
            }
            catch (error) {
                appEvents.emit(AppEvents.alertError, ['Unable to add to selection']);
            }
        };
        this.root = this.load(cfg, enableEditing, showAdvancedTypes);
        this.subscription = this.editModeEnabled.subscribe((open) => {
            if (!this.moveable || !this.isEditingEnabled) {
                return;
            }
            this.moveable.draggable = !open;
        });
        this.panel = panel;
        this.connections = new Connections(this);
    }
    load(cfg, enableEditing, showAdvancedTypes) {
        this.root = new RootElement(cfg !== null && cfg !== void 0 ? cfg : {
            type: 'frame',
            elements: [DEFAULT_CANVAS_ELEMENT_CONFIG],
        }, this, this.save // callback when changes are made
        );
        this.isEditingEnabled = enableEditing;
        this.shouldShowAdvancedTypes = showAdvancedTypes;
        setTimeout(() => {
            if (this.div) {
                // If editing is enabled, clear selecto instance
                const destroySelecto = enableEditing;
                this.initMoveable(destroySelecto, enableEditing);
                this.currentLayer = this.root;
                this.selection.next([]);
                this.connections.select(undefined);
                this.connections.updateState();
            }
        });
        return this.root;
    }
    updateData(data) {
        this.data = data;
        this.root.updateData(this.context);
    }
    updateSize(width, height) {
        var _a;
        this.width = width;
        this.height = height;
        this.style = { width, height };
        if ((_a = this.selecto) === null || _a === void 0 ? void 0 : _a.getSelectedTargets().length) {
            this.clearCurrentSelection();
        }
    }
    frameSelection() {
        this.selection.pipe(first()).subscribe((currentSelectedElements) => {
            var _a;
            const currentLayer = currentSelectedElements[0].parent;
            const newLayer = new FrameState({
                type: 'frame',
                name: this.getNextElementName(true),
                elements: [],
            }, this, currentSelectedElements[0].parent);
            const framePlacement = this.generateFrameContainer(currentSelectedElements);
            newLayer.options.placement = framePlacement;
            currentSelectedElements.forEach((element) => {
                var _a;
                const elementContainer = (_a = element.div) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect();
                element.setPlacementFromConstraint(elementContainer, framePlacement);
                currentLayer.doAction(LayerActionID.Delete, element);
                newLayer.doAction(LayerActionID.Duplicate, element, false, false);
            });
            newLayer.setPlacementFromConstraint(framePlacement, (_a = currentLayer.div) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect());
            currentLayer.elements.push(newLayer);
            this.byName.set(newLayer.getName(), newLayer);
            this.save();
        });
    }
    clearCurrentSelection(skipNextSelectionBroadcast = false) {
        var _a;
        this.skipNextSelectionBroadcast = skipNextSelectionBroadcast;
        let event = new MouseEvent('click');
        (_a = this.selecto) === null || _a === void 0 ? void 0 : _a.clickTarget(event, this.div);
    }
    updateCurrentLayer(newLayer) {
        this.currentLayer = newLayer;
        this.clearCurrentSelection();
        this.save();
    }
    render() {
        var _a, _b, _c, _d, _e;
        const canShowContextMenu = this.isPanelEditing || (!this.isPanelEditing && this.isEditingEnabled);
        const isTooltipValid = ((_e = (_d = (_c = (_b = (_a = this.tooltip) === null || _a === void 0 ? void 0 : _a.element) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.links) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : 0) > 0;
        const canShowElementTooltip = !this.isEditingEnabled && isTooltipValid;
        return (React.createElement("div", { key: this.revId, className: this.styles.wrap, style: this.style, ref: this.setRef },
            this.connections.render(),
            this.root.render(),
            canShowContextMenu && (React.createElement(Portal, null,
                React.createElement(CanvasContextMenu, { scene: this, panel: this.panel }))),
            canShowElementTooltip && (React.createElement(Portal, null,
                React.createElement(CanvasTooltip, { scene: this })))));
    }
}
const getStyles = stylesFactory((theme) => ({
    wrap: css `
    overflow: hidden;
    position: relative;
  `,
    selected: css `
    z-index: 999 !important;
  `,
}));
//# sourceMappingURL=scene.js.map