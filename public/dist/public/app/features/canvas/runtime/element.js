import { __assign } from "tslib";
import React from 'react';
import { BackgroundImageSize, canvasElementRegistry, } from 'app/features/canvas';
import { notFoundItem } from 'app/features/canvas/elements/notFound';
var counter = 0;
var ElementState = /** @class */ (function () {
    function ElementState(item, options, parent) {
        var _this = this;
        var _a, _b;
        this.item = item;
        this.options = options;
        this.parent = parent;
        this.UID = counter++;
        this.revId = 0;
        this.sizeStyle = {};
        this.dataStyle = {};
        // Calculated
        this.width = 100;
        this.height = 100;
        this.initElement = function (target) {
            _this.div = target;
        };
        this.applyDrag = function (event) {
            var _a = _this, placement = _a.placement, anchor = _a.anchor;
            var deltaX = event.delta[0];
            var deltaY = event.delta[1];
            var style = event.target.style;
            if (anchor.top) {
                placement.top += deltaY;
                style.top = placement.top + "px";
            }
            if (anchor.bottom) {
                placement.bottom -= deltaY;
                style.bottom = placement.bottom + "px";
            }
            if (anchor.left) {
                placement.left += deltaX;
                style.left = placement.left + "px";
            }
            if (anchor.right) {
                placement.right -= deltaX;
                style.right = placement.right + "px";
            }
        };
        // kinda like:
        // https://github.com/grafana/grafana-edge-app/blob/main/src/panels/draw/WrapItem.tsx#L44
        this.applyResize = function (event) {
            var _a = _this, placement = _a.placement, anchor = _a.anchor;
            var style = event.target.style;
            var deltaX = event.delta[0];
            var deltaY = event.delta[1];
            var dirLR = event.direction[0];
            var dirTB = event.direction[1];
            if (dirLR === 1) {
                // RIGHT
                if (anchor.right) {
                    placement.right -= deltaX;
                    style.right = placement.right + "px";
                    if (!anchor.left) {
                        placement.width = event.width;
                        style.width = placement.width + "px";
                    }
                }
                else {
                    placement.width = event.width;
                    style.width = placement.width + "px";
                }
            }
            else if (dirLR === -1) {
                // LEFT
                if (anchor.left) {
                    placement.left -= deltaX;
                    placement.width = event.width;
                    style.left = placement.left + "px";
                    style.width = placement.width + "px";
                }
                else {
                    placement.width += deltaX;
                    style.width = placement.width + "px";
                }
            }
            if (dirTB === -1) {
                // TOP
                if (anchor.top) {
                    placement.top -= deltaY;
                    placement.height = event.height;
                    style.top = placement.top + "px";
                    style.height = placement.height + "px";
                }
                else {
                    placement.height = event.height;
                    style.height = placement.height + "px";
                }
            }
            else if (dirTB === 1) {
                // BOTTOM
                if (anchor.bottom) {
                    placement.bottom -= deltaY;
                    placement.height = event.height;
                    style.bottom = placement.bottom + "px";
                    style.height = placement.height + "px";
                }
                else {
                    placement.height = event.height;
                    style.height = placement.height + "px";
                }
            }
            _this.width = event.width;
            _this.height = event.height;
        };
        if (!options) {
            this.options = { type: item.id };
        }
        this.anchor = (_a = options.anchor) !== null && _a !== void 0 ? _a : {};
        this.placement = (_b = options.placement) !== null && _b !== void 0 ? _b : {};
        options.anchor = this.anchor;
        options.placement = this.placement;
    }
    ElementState.prototype.validatePlacement = function () {
        var _a, _b;
        var _c = this, anchor = _c.anchor, placement = _c.placement;
        if (!(anchor.left || anchor.right)) {
            anchor.left = true;
        }
        if (!(anchor.top || anchor.bottom)) {
            anchor.top = true;
        }
        var w = (_a = placement.width) !== null && _a !== void 0 ? _a : 100; // this.div ? this.div.clientWidth : this.width;
        var h = (_b = placement.height) !== null && _b !== void 0 ? _b : 100; // this.div ? this.div.clientHeight : this.height;
        if (anchor.top) {
            if (!placement.top) {
                placement.top = 0;
            }
            if (anchor.bottom) {
                delete placement.height;
            }
            else {
                placement.height = h;
                delete placement.bottom;
            }
        }
        else if (anchor.bottom) {
            if (!placement.bottom) {
                placement.bottom = 0;
            }
            placement.height = h;
            delete placement.top;
        }
        if (anchor.left) {
            if (!placement.left) {
                placement.left = 0;
            }
            if (anchor.right) {
                delete placement.width;
            }
            else {
                placement.width = w;
                delete placement.right;
            }
        }
        else if (anchor.right) {
            if (!placement.right) {
                placement.right = 0;
            }
            placement.width = w;
            delete placement.left;
        }
        this.width = w;
        this.height = h;
        this.options.anchor = this.anchor;
        this.options.placement = this.placement;
        // console.log('validate', this.UID, this.item.id, this.placement, this.anchor);
    };
    // The parent size, need to set our own size based on offsets
    ElementState.prototype.updateSize = function (width, height) {
        this.width = width;
        this.height = height;
        this.validatePlacement();
        // Update the CSS position
        this.sizeStyle = __assign(__assign({}, this.options.placement), { position: 'absolute' });
    };
    ElementState.prototype.updateData = function (ctx) {
        var _a;
        if (this.item.prepareData) {
            this.data = this.item.prepareData(ctx, this.options.config);
            this.revId++; // rerender
        }
        var _b = this.options, background = _b.background, border = _b.border;
        var css = {};
        if (background) {
            if (background.color) {
                var color = ctx.getColor(background.color);
                css.backgroundColor = color.value();
            }
            if (background.image) {
                var image = ctx.getResource(background.image);
                if (image) {
                    var v = image.value();
                    if (v) {
                        css.backgroundImage = "url(\"" + v + "\")";
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
                }
            }
        }
        if (border && border.color && border.width) {
            var color = ctx.getColor(border.color);
            css.borderWidth = border.width;
            css.borderStyle = 'solid';
            css.borderColor = color.value();
            // Move the image to inside the border
            if (css.backgroundImage) {
                css.backgroundOrigin = 'padding-box';
            }
        }
        this.dataStyle = css;
    };
    /** Recursively visit all nodes */
    ElementState.prototype.visit = function (visitor) {
        visitor(this);
    };
    ElementState.prototype.onChange = function (options) {
        var _a;
        if (this.item.id !== options.type) {
            this.item = (_a = canvasElementRegistry.getIfExists(options.type)) !== null && _a !== void 0 ? _a : notFoundItem;
        }
        this.revId++;
        this.options = __assign({}, options);
        var trav = this.parent;
        while (trav) {
            if (trav.isRoot()) {
                trav.scene.save();
                break;
            }
            trav.revId++;
            trav = trav.parent;
        }
    };
    ElementState.prototype.getSaveModel = function () {
        return __assign({}, this.options);
    };
    ElementState.prototype.render = function () {
        var item = this.item;
        return (React.createElement("div", { key: "" + this.UID, style: __assign(__assign({}, this.sizeStyle), this.dataStyle), ref: this.initElement },
            React.createElement(item.display, { key: this.UID + "/" + this.revId, config: this.options.config, width: this.width, height: this.height, data: this.data })));
    };
    return ElementState;
}());
export { ElementState };
//# sourceMappingURL=element.js.map