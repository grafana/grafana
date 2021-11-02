import React from 'react';
// Fluent API for defining and rendering layout
var LayoutBuilder = /** @class */ (function () {
    function LayoutBuilder(renderer, refsMap, width, height) {
        this.renderer = renderer;
        this.refsMap = refsMap;
        this.width = width;
        this.height = height;
        this.layout = {};
    }
    LayoutBuilder.prototype.getLayout = function () {
        return this.layout;
    };
    LayoutBuilder.prototype.addSlot = function (id, node) {
        this.layout[id] = node;
        return this;
    };
    LayoutBuilder.prototype.clearSlot = function (id) {
        if (this.layout[id] && this.refsMap[id]) {
            delete this.layout[id];
            this.refsMap[id](null);
        }
        return this;
    };
    LayoutBuilder.prototype.render = function () {
        if (!this.layout) {
            return null;
        }
        return React.createElement(this.renderer, {
            slots: this.layout,
            refs: this.refsMap,
            width: this.width,
            height: this.height,
        });
    };
    return LayoutBuilder;
}());
export { LayoutBuilder };
//# sourceMappingURL=LayoutBuilder.js.map