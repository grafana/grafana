import { cloneDeep } from 'lodash';
import React from 'react';
import { canvasElementRegistry } from 'app/features/canvas';
import { notFoundItem } from 'app/features/canvas/elements/notFound';
import { LayerActionID } from 'app/plugins/panel/canvas/types';
import { updateConnectionsForSource } from '../../../plugins/panel/canvas/utils';
import { HorizontalConstraint, VerticalConstraint } from '../types';
import { ElementState } from './element';
const DEFAULT_OFFSET = 10;
const HORIZONTAL_OFFSET = 50;
export const frameItemDummy = {
    id: 'frame',
    name: 'Frame',
    description: 'Frame',
    getNewOptions: () => ({
        config: {},
    }),
    // eslint-disable-next-line react/display-name
    display: () => {
        return React.createElement("div", null, "FRAME!");
    },
};
export class FrameState extends ElementState {
    constructor(options, scene, parent) {
        var _a;
        super(frameItemDummy, options, parent);
        this.options = options;
        this.parent = parent;
        this.elements = [];
        // ??? or should this be on the element directly?
        // are actions scoped to layers?
        this.doAction = (action, element, updateName = true, shiftItemsOnDuplicate = true) => {
            var _a, _b;
            switch (action) {
                case LayerActionID.Delete:
                    this.elements = this.elements.filter((e) => e !== element);
                    updateConnectionsForSource(element, this.scene);
                    this.scene.byName.delete(element.options.name);
                    this.scene.save();
                    this.reinitializeMoveable();
                    break;
                case LayerActionID.Duplicate:
                    if (element.item.id === 'frame') {
                        console.log('Can not duplicate frames (yet)', action, element);
                        return;
                    }
                    const opts = cloneDeep(element.options);
                    if (shiftItemsOnDuplicate) {
                        const { constraint, placement: oldPlacement } = element.options;
                        const { vertical, horizontal } = constraint !== null && constraint !== void 0 ? constraint : {};
                        const placement = (_a = Object.assign({}, oldPlacement)) !== null && _a !== void 0 ? _a : {};
                        switch (vertical) {
                            case VerticalConstraint.Top:
                                if (placement.top == null) {
                                    placement.top = 25;
                                }
                                else {
                                    placement.top += DEFAULT_OFFSET;
                                }
                                break;
                            case VerticalConstraint.Bottom:
                                if (placement.bottom == null) {
                                    placement.bottom = 100;
                                }
                                else {
                                    placement.bottom -= DEFAULT_OFFSET;
                                }
                                break;
                            case VerticalConstraint.TopBottom:
                                if (placement.top == null) {
                                    placement.top = 25;
                                }
                                else {
                                    placement.top += DEFAULT_OFFSET;
                                }
                                if (placement.bottom == null) {
                                    placement.bottom = 100;
                                }
                                else {
                                    placement.bottom -= DEFAULT_OFFSET;
                                }
                                break;
                            case VerticalConstraint.Center:
                                if (placement.top != null) {
                                    placement.top -= DEFAULT_OFFSET;
                                }
                                break;
                        }
                        switch (horizontal) {
                            case HorizontalConstraint.Left:
                                if (placement.left == null) {
                                    placement.left = HORIZONTAL_OFFSET;
                                }
                                else {
                                    placement.left += DEFAULT_OFFSET;
                                }
                                break;
                            case HorizontalConstraint.Right:
                                if (placement.right == null) {
                                    placement.right = HORIZONTAL_OFFSET;
                                }
                                else {
                                    placement.right -= DEFAULT_OFFSET;
                                }
                                break;
                            case HorizontalConstraint.LeftRight:
                                if (placement.left == null) {
                                    placement.left = HORIZONTAL_OFFSET;
                                }
                                else {
                                    placement.left += DEFAULT_OFFSET;
                                }
                                if (placement.right == null) {
                                    placement.right = HORIZONTAL_OFFSET;
                                }
                                else {
                                    placement.right -= DEFAULT_OFFSET;
                                }
                                break;
                            case HorizontalConstraint.Center:
                                if (placement.left != null) {
                                    placement.left -= DEFAULT_OFFSET;
                                }
                                break;
                        }
                        opts.placement = placement;
                    }
                    // Clear connections on duplicate
                    opts.connections = undefined;
                    const copy = new ElementState(element.item, opts, this);
                    copy.updateData(this.scene.context);
                    if (updateName) {
                        copy.options.name = this.scene.getNextElementName();
                    }
                    this.elements.push(copy);
                    this.scene.byName.set(copy.options.name, copy);
                    // Update scene byName map for original element (to avoid stale references (e.g. for connections))
                    this.scene.byName.set(element.options.name, element);
                    this.scene.save();
                    this.reinitializeMoveable();
                    setTimeout(() => {
                        this.scene.targetsToSelect.add(copy.div);
                    });
                    break;
                case LayerActionID.MoveTop:
                case LayerActionID.MoveBottom:
                    (_b = element.parent) === null || _b === void 0 ? void 0 : _b.doMove(element, action);
                    break;
                default:
                    console.log('DO action', action, element);
                    return;
            }
        };
        this.scene = scene;
        // mutate options object
        let { elements } = this.options;
        if (!elements) {
            this.options.elements = elements = [];
        }
        for (const c of elements) {
            if (c.type === 'frame') {
                this.elements.push(new FrameState(c, scene, this));
            }
            else {
                const item = (_a = canvasElementRegistry.getIfExists(c.type)) !== null && _a !== void 0 ? _a : notFoundItem;
                this.elements.push(new ElementState(item, c, this));
            }
        }
    }
    isRoot() {
        return false;
    }
    updateData(ctx) {
        super.updateData(ctx);
        for (const elem of this.elements) {
            elem.updateData(ctx);
        }
    }
    // used in the layer editor
    reorder(startIndex, endIndex) {
        const result = Array.from(this.elements);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        this.elements = result;
        this.reinitializeMoveable();
    }
    // used for tree view
    reorderTree(src, dest, firstPosition = false) {
        const result = Array.from(this.elements);
        const srcIndex = this.elements.indexOf(src);
        const destIndex = firstPosition ? this.elements.length - 1 : this.elements.indexOf(dest);
        const [removed] = result.splice(srcIndex, 1);
        result.splice(destIndex, 0, removed);
        this.elements = result;
        this.reinitializeMoveable();
    }
    doMove(child, action) {
        const vals = this.elements.filter((v) => v !== child);
        if (action === LayerActionID.MoveBottom) {
            vals.unshift(child);
        }
        else {
            vals.push(child);
        }
        this.elements = vals;
        this.scene.save();
        this.reinitializeMoveable();
    }
    reinitializeMoveable() {
        // Need to first clear current selection and then re-init moveable with slight delay
        this.scene.clearCurrentSelection();
        setTimeout(() => this.scene.initMoveable(true, this.scene.isEditingEnabled));
    }
    render() {
        return (React.createElement("div", { key: this.UID, ref: this.initElement }, this.elements.map((v) => v.render())));
    }
    /** Recursively visit all nodes */
    visit(visitor) {
        super.visit(visitor);
        for (const e of this.elements) {
            visitor(e);
        }
    }
    getSaveModel() {
        return Object.assign(Object.assign({}, this.options), { elements: this.elements.map((v) => v.getSaveModel()) });
    }
}
//# sourceMappingURL=frame.js.map