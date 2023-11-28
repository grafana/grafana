import React from 'react';
import { BackgroundImageSize, canvasElementRegistry, } from 'app/features/canvas';
import { notFoundItem } from 'app/features/canvas/elements/notFound';
import { getConnectionsByTarget, isConnectionTarget } from 'app/plugins/panel/canvas/utils';
import { HorizontalConstraint, VerticalConstraint } from '../types';
let counter = 0;
export class ElementState {
    constructor(item, options, parent) {
        var _a, _b, _c, _d;
        this.item = item;
        this.options = options;
        this.parent = parent;
        // UID necessary for moveable to work (for now)
        this.UID = counter++;
        this.revId = 0;
        this.sizeStyle = {};
        this.dataStyle = {};
        this.initElement = (target) => {
            this.div = target;
            this.applyLayoutStylesToDiv();
        };
        this.applyDrag = (event) => {
            var _a, _b, _c, _d, _e, _f, _g;
            const hasHorizontalCenterConstraint = ((_a = this.options.constraint) === null || _a === void 0 ? void 0 : _a.horizontal) === HorizontalConstraint.Center;
            const hasVerticalCenterConstraint = ((_b = this.options.constraint) === null || _b === void 0 ? void 0 : _b.vertical) === VerticalConstraint.Center;
            if (hasHorizontalCenterConstraint || hasVerticalCenterConstraint) {
                const numberOfTargets = (_e = (_d = (_c = this.getScene()) === null || _c === void 0 ? void 0 : _c.selecto) === null || _d === void 0 ? void 0 : _d.getSelectedTargets().length) !== null && _e !== void 0 ? _e : 0;
                const isMultiSelection = numberOfTargets > 1;
                if (!isMultiSelection) {
                    const elementContainer = (_f = this.div) === null || _f === void 0 ? void 0 : _f.getBoundingClientRect();
                    const height = (_g = elementContainer === null || elementContainer === void 0 ? void 0 : elementContainer.height) !== null && _g !== void 0 ? _g : 100;
                    const yOffset = hasVerticalCenterConstraint ? height / 4 : 0;
                    event.target.style.transform = `translate(${event.translate[0]}px, ${event.translate[1] - yOffset}px)`;
                    return;
                }
            }
            event.target.style.transform = event.transform;
        };
        // kinda like:
        // https://github.com/grafana/grafana-edge-app/blob/main/src/panels/draw/WrapItem.tsx#L44
        this.applyResize = (event) => {
            const placement = this.options.placement;
            const style = event.target.style;
            const deltaX = event.delta[0];
            const deltaY = event.delta[1];
            const dirLR = event.direction[0];
            const dirTB = event.direction[1];
            if (dirLR === 1) {
                placement.width = event.width;
                style.width = `${placement.width}px`;
            }
            else if (dirLR === -1) {
                placement.left -= deltaX;
                placement.width = event.width;
                style.left = `${placement.left}px`;
                style.width = `${placement.width}px`;
            }
            if (dirTB === -1) {
                placement.top -= deltaY;
                placement.height = event.height;
                style.top = `${placement.top}px`;
                style.height = `${placement.height}px`;
            }
            else if (dirTB === 1) {
                placement.height = event.height;
                style.height = `${placement.height}px`;
            }
        };
        this.handleMouseEnter = (event, isSelected) => {
            const scene = this.getScene();
            if (!(scene === null || scene === void 0 ? void 0 : scene.isEditingEnabled)) {
                this.handleTooltip(event);
            }
            else if (!isSelected) {
                scene === null || scene === void 0 ? void 0 : scene.connections.handleMouseEnter(event);
            }
        };
        this.handleTooltip = (event) => {
            var _a, _b, _c;
            const scene = this.getScene();
            if (scene === null || scene === void 0 ? void 0 : scene.tooltipCallback) {
                const rect = (_a = this.div) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect();
                scene.tooltipCallback({
                    anchorPoint: { x: (_b = rect === null || rect === void 0 ? void 0 : rect.right) !== null && _b !== void 0 ? _b : event.pageX, y: (_c = rect === null || rect === void 0 ? void 0 : rect.top) !== null && _c !== void 0 ? _c : event.pageY },
                    element: this,
                    isOpen: false,
                });
            }
        };
        this.handleMouseLeave = (event) => {
            var _a;
            const scene = this.getScene();
            if ((scene === null || scene === void 0 ? void 0 : scene.tooltipCallback) && !((_a = scene === null || scene === void 0 ? void 0 : scene.tooltip) === null || _a === void 0 ? void 0 : _a.isOpen)) {
                scene.tooltipCallback(undefined);
            }
        };
        this.onElementClick = (event) => {
            this.onTooltipCallback();
        };
        this.onElementKeyDown = (event) => {
            if (event.key === 'Enter' &&
                (event.currentTarget instanceof HTMLElement || event.currentTarget instanceof SVGElement)) {
                const scene = this.getScene();
                scene === null || scene === void 0 ? void 0 : scene.select({ targets: [event.currentTarget] });
            }
        };
        this.onTooltipCallback = () => {
            var _a;
            const scene = this.getScene();
            if ((scene === null || scene === void 0 ? void 0 : scene.tooltipCallback) && ((_a = scene.tooltip) === null || _a === void 0 ? void 0 : _a.anchorPoint)) {
                scene.tooltipCallback({
                    anchorPoint: { x: scene.tooltip.anchorPoint.x, y: scene.tooltip.anchorPoint.y },
                    element: this,
                    isOpen: true,
                });
            }
        };
        const fallbackName = `Element ${Date.now()}`;
        if (!options) {
            this.options = { type: item.id, name: fallbackName };
        }
        options.constraint = (_a = options.constraint) !== null && _a !== void 0 ? _a : {
            vertical: VerticalConstraint.Top,
            horizontal: HorizontalConstraint.Left,
        };
        options.placement = (_b = options.placement) !== null && _b !== void 0 ? _b : { width: 100, height: 100, top: 0, left: 0 };
        options.background = (_c = options.background) !== null && _c !== void 0 ? _c : { color: { fixed: 'transparent' } };
        options.border = (_d = options.border) !== null && _d !== void 0 ? _d : { color: { fixed: 'dark-green' } };
        const scene = this.getScene();
        if (!options.name) {
            const newName = scene === null || scene === void 0 ? void 0 : scene.getNextElementName();
            options.name = newName !== null && newName !== void 0 ? newName : fallbackName;
        }
        scene === null || scene === void 0 ? void 0 : scene.byName.set(options.name, this);
    }
    getScene() {
        let trav = this.parent;
        while (trav) {
            if (trav.isRoot()) {
                return trav.scene;
            }
            trav = trav.parent;
        }
        return undefined;
    }
    getName() {
        return this.options.name;
    }
    /** Use the configured options to update CSS style properties directly on the wrapper div **/
    applyLayoutStylesToDiv(disablePointerEvents) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
        if (this.isRoot()) {
            // Root supersedes layout engine and is always 100% width + height of panel
            return;
        }
        const { constraint } = this.options;
        const { vertical, horizontal } = constraint !== null && constraint !== void 0 ? constraint : {};
        const placement = (_a = this.options.placement) !== null && _a !== void 0 ? _a : {};
        const editingEnabled = (_b = this.getScene()) === null || _b === void 0 ? void 0 : _b.isEditingEnabled;
        const style = {
            cursor: editingEnabled ? 'grab' : 'auto',
            pointerEvents: disablePointerEvents ? 'none' : 'auto',
            position: 'absolute',
            // Minimum element size is 10x10
            minWidth: '10px',
            minHeight: '10px',
        };
        const translate = ['0px', '0px'];
        switch (vertical) {
            case VerticalConstraint.Top:
                placement.top = (_c = placement.top) !== null && _c !== void 0 ? _c : 0;
                placement.height = (_d = placement.height) !== null && _d !== void 0 ? _d : 100;
                style.top = `${placement.top}px`;
                style.height = `${placement.height}px`;
                delete placement.bottom;
                break;
            case VerticalConstraint.Bottom:
                placement.bottom = (_e = placement.bottom) !== null && _e !== void 0 ? _e : 0;
                placement.height = (_f = placement.height) !== null && _f !== void 0 ? _f : 100;
                style.bottom = `${placement.bottom}px`;
                style.height = `${placement.height}px`;
                delete placement.top;
                break;
            case VerticalConstraint.TopBottom:
                placement.top = (_g = placement.top) !== null && _g !== void 0 ? _g : 0;
                placement.bottom = (_h = placement.bottom) !== null && _h !== void 0 ? _h : 0;
                style.top = `${placement.top}px`;
                style.bottom = `${placement.bottom}px`;
                delete placement.height;
                style.height = '';
                break;
            case VerticalConstraint.Center:
                placement.top = (_j = placement.top) !== null && _j !== void 0 ? _j : 0;
                placement.height = (_k = placement.height) !== null && _k !== void 0 ? _k : 100;
                translate[1] = '-50%';
                style.top = `calc(50% - ${placement.top}px)`;
                style.height = `${placement.height}px`;
                delete placement.bottom;
                break;
            case VerticalConstraint.Scale:
                placement.top = (_l = placement.top) !== null && _l !== void 0 ? _l : 0;
                placement.bottom = (_m = placement.bottom) !== null && _m !== void 0 ? _m : 0;
                style.top = `${placement.top}%`;
                style.bottom = `${placement.bottom}%`;
                delete placement.height;
                style.height = '';
                break;
        }
        switch (horizontal) {
            case HorizontalConstraint.Left:
                placement.left = (_o = placement.left) !== null && _o !== void 0 ? _o : 0;
                placement.width = (_p = placement.width) !== null && _p !== void 0 ? _p : 100;
                style.left = `${placement.left}px`;
                style.width = `${placement.width}px`;
                delete placement.right;
                break;
            case HorizontalConstraint.Right:
                placement.right = (_q = placement.right) !== null && _q !== void 0 ? _q : 0;
                placement.width = (_r = placement.width) !== null && _r !== void 0 ? _r : 100;
                style.right = `${placement.right}px`;
                style.width = `${placement.width}px`;
                delete placement.left;
                break;
            case HorizontalConstraint.LeftRight:
                placement.left = (_s = placement.left) !== null && _s !== void 0 ? _s : 0;
                placement.right = (_t = placement.right) !== null && _t !== void 0 ? _t : 0;
                style.left = `${placement.left}px`;
                style.right = `${placement.right}px`;
                delete placement.width;
                style.width = '';
                break;
            case HorizontalConstraint.Center:
                placement.left = (_u = placement.left) !== null && _u !== void 0 ? _u : 0;
                placement.width = (_v = placement.width) !== null && _v !== void 0 ? _v : 100;
                translate[0] = '-50%';
                style.left = `calc(50% - ${placement.left}px)`;
                style.width = `${placement.width}px`;
                delete placement.right;
                break;
            case HorizontalConstraint.Scale:
                placement.left = (_w = placement.left) !== null && _w !== void 0 ? _w : 0;
                placement.right = (_x = placement.right) !== null && _x !== void 0 ? _x : 0;
                style.left = `${placement.left}%`;
                style.right = `${placement.right}%`;
                delete placement.width;
                style.width = '';
                break;
        }
        style.transform = `translate(${translate[0]}, ${translate[1]})`;
        this.options.placement = placement;
        this.sizeStyle = style;
        if (this.div) {
            for (const key in this.sizeStyle) {
                this.div.style[key] = this.sizeStyle[key];
            }
            for (const key in this.dataStyle) {
                this.div.style[key] = this.dataStyle[key];
            }
        }
    }
    setPlacementFromConstraint(elementContainer, parentContainer) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const { constraint } = this.options;
        const { vertical, horizontal } = constraint !== null && constraint !== void 0 ? constraint : {};
        if (!elementContainer) {
            elementContainer = this.div && this.div.getBoundingClientRect();
        }
        let parentBorderWidth = 0;
        if (!parentContainer) {
            parentContainer = this.div && ((_a = this.div.parentElement) === null || _a === void 0 ? void 0 : _a.getBoundingClientRect());
            parentBorderWidth = ((_b = this.parent) === null || _b === void 0 ? void 0 : _b.isRoot())
                ? 0
                : parseFloat(getComputedStyle((_c = this.div) === null || _c === void 0 ? void 0 : _c.parentElement).borderWidth);
        }
        const relativeTop = elementContainer && parentContainer
            ? Math.round(elementContainer.top - parentContainer.top - parentBorderWidth)
            : 0;
        const relativeBottom = elementContainer && parentContainer
            ? Math.round(parentContainer.bottom - parentBorderWidth - elementContainer.bottom)
            : 0;
        const relativeLeft = elementContainer && parentContainer
            ? Math.round(elementContainer.left - parentContainer.left - parentBorderWidth)
            : 0;
        const relativeRight = elementContainer && parentContainer
            ? Math.round(parentContainer.right - parentBorderWidth - elementContainer.right)
            : 0;
        const placement = {};
        const width = (_d = elementContainer === null || elementContainer === void 0 ? void 0 : elementContainer.width) !== null && _d !== void 0 ? _d : 100;
        const height = (_e = elementContainer === null || elementContainer === void 0 ? void 0 : elementContainer.height) !== null && _e !== void 0 ? _e : 100;
        switch (vertical) {
            case VerticalConstraint.Top:
                placement.top = relativeTop;
                placement.height = height;
                break;
            case VerticalConstraint.Bottom:
                placement.bottom = relativeBottom;
                placement.height = height;
                break;
            case VerticalConstraint.TopBottom:
                placement.top = relativeTop;
                placement.bottom = relativeBottom;
                break;
            case VerticalConstraint.Center:
                const elementCenter = elementContainer ? relativeTop + height / 2 : 0;
                const parentCenter = parentContainer ? parentContainer.height / 2 : 0;
                const distanceFromCenter = parentCenter - elementCenter;
                placement.top = distanceFromCenter;
                placement.height = height;
                break;
            case VerticalConstraint.Scale:
                placement.top = (relativeTop / ((_f = parentContainer === null || parentContainer === void 0 ? void 0 : parentContainer.height) !== null && _f !== void 0 ? _f : height)) * 100;
                placement.bottom = (relativeBottom / ((_g = parentContainer === null || parentContainer === void 0 ? void 0 : parentContainer.height) !== null && _g !== void 0 ? _g : height)) * 100;
                break;
        }
        switch (horizontal) {
            case HorizontalConstraint.Left:
                placement.left = relativeLeft;
                placement.width = width;
                break;
            case HorizontalConstraint.Right:
                placement.right = relativeRight;
                placement.width = width;
                break;
            case HorizontalConstraint.LeftRight:
                placement.left = relativeLeft;
                placement.right = relativeRight;
                break;
            case HorizontalConstraint.Center:
                const elementCenter = elementContainer ? relativeLeft + width / 2 : 0;
                const parentCenter = parentContainer ? parentContainer.width / 2 : 0;
                const distanceFromCenter = parentCenter - elementCenter;
                placement.left = distanceFromCenter;
                placement.width = width;
                break;
            case HorizontalConstraint.Scale:
                placement.left = (relativeLeft / ((_h = parentContainer === null || parentContainer === void 0 ? void 0 : parentContainer.width) !== null && _h !== void 0 ? _h : width)) * 100;
                placement.right = (relativeRight / ((_j = parentContainer === null || parentContainer === void 0 ? void 0 : parentContainer.width) !== null && _j !== void 0 ? _j : width)) * 100;
                break;
        }
        this.options.placement = placement;
        this.applyLayoutStylesToDiv();
        this.revId++;
        (_k = this.getScene()) === null || _k === void 0 ? void 0 : _k.save();
    }
    updateData(ctx) {
        var _a;
        if (this.item.prepareData) {
            this.data = this.item.prepareData(ctx, this.options.config);
            this.revId++; // rerender
        }
        const { background, border } = this.options;
        const css = {};
        if (background) {
            if (background.color) {
                const color = ctx.getColor(background.color);
                css.backgroundColor = color.value();
            }
            if (background.image) {
                const image = ctx.getResource(background.image);
                if (image) {
                    const v = image.value();
                    if (v) {
                        css.backgroundImage = `url("${v}")`;
                        switch ((_a = background.size) !== null && _a !== void 0 ? _a : BackgroundImageSize.Contain) {
                            case BackgroundImageSize.Contain:
                                css.backgroundSize = 'contain';
                                css.backgroundRepeat = 'no-repeat';
                                break;
                            case BackgroundImageSize.Cover:
                                css.backgroundSize = 'cover';
                                css.backgroundRepeat = 'no-repeat';
                                break;
                            case BackgroundImageSize.Original:
                                css.backgroundRepeat = 'no-repeat';
                                break;
                            case BackgroundImageSize.Tile:
                                css.backgroundRepeat = 'repeat';
                                break;
                            case BackgroundImageSize.Fill:
                                css.backgroundSize = '100% 100%';
                                break;
                        }
                    }
                    else {
                        css.backgroundImage = '';
                    }
                }
            }
        }
        if (border && border.color && border.width !== undefined) {
            const color = ctx.getColor(border.color);
            css.borderWidth = `${border.width}px`;
            css.borderStyle = 'solid';
            css.borderColor = color.value();
            // Move the image to inside the border
            if (css.backgroundImage) {
                css.backgroundOrigin = 'padding-box';
            }
        }
        this.dataStyle = css;
        this.applyLayoutStylesToDiv();
    }
    isRoot() {
        return false;
    }
    /** Recursively visit all nodes */
    visit(visitor) {
        visitor(this);
    }
    onChange(options) {
        var _a;
        if (this.item.id !== options.type) {
            this.item = (_a = canvasElementRegistry.getIfExists(options.type)) !== null && _a !== void 0 ? _a : notFoundItem;
        }
        // rename handling
        const oldName = this.options.name;
        const newName = options.name;
        this.revId++;
        this.options = Object.assign({}, options);
        let trav = this.parent;
        while (trav) {
            if (trav.isRoot()) {
                trav.scene.save();
                break;
            }
            trav.revId++;
            trav = trav.parent;
        }
        const scene = this.getScene();
        if (oldName !== newName && scene) {
            if (isConnectionTarget(this, scene.byName)) {
                getConnectionsByTarget(this, scene).forEach((connection) => {
                    connection.info.targetName = newName;
                });
            }
            scene.byName.delete(oldName);
            scene.byName.set(newName, this);
        }
    }
    getSaveModel() {
        return Object.assign({}, this.options);
    }
    render() {
        const { item, div } = this;
        const scene = this.getScene();
        // TODO: Rethink selected state handling
        const isSelected = div && scene && scene.selecto && scene.selecto.getSelectedTargets().includes(div);
        return (React.createElement("div", { key: this.UID, ref: this.initElement, onMouseEnter: (e) => this.handleMouseEnter(e, isSelected), onMouseLeave: !(scene === null || scene === void 0 ? void 0 : scene.isEditingEnabled) ? this.handleMouseLeave : undefined, onClick: !(scene === null || scene === void 0 ? void 0 : scene.isEditingEnabled) ? this.onElementClick : undefined, onKeyDown: !(scene === null || scene === void 0 ? void 0 : scene.isEditingEnabled) ? this.onElementKeyDown : undefined, role: "button", tabIndex: 0 },
            React.createElement(item.display, { key: `${this.UID}/${this.revId}`, config: this.options.config, data: this.data, isSelected: isSelected })));
    }
}
//# sourceMappingURL=element.js.map