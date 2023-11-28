import { __rest } from "tslib";
import React from 'react';
import { FrameState } from './frame';
export class RootElement extends FrameState {
    constructor(options, scene, changeCallback) {
        super(options, scene);
        this.options = options;
        this.scene = scene;
        this.changeCallback = changeCallback;
        this.setRootRef = (target) => {
            this.div = target;
        };
        this.sizeStyle = {
            height: '100%',
            width: '100%',
        };
    }
    isRoot() {
        return true;
    }
    // root type can not change
    onChange(options) {
        this.revId++;
        this.options = Object.assign({}, options);
        this.changeCallback();
    }
    getSaveModel() {
        const _a = this.options, { placement, constraint } = _a, rest = __rest(_a, ["placement", "constraint"]);
        return Object.assign(Object.assign({}, rest), { elements: this.elements.map((v) => v.getSaveModel()) });
    }
    render() {
        return (React.createElement("div", { onContextMenu: (event) => event.preventDefault(), key: this.UID, ref: this.setRootRef, style: Object.assign(Object.assign({}, this.sizeStyle), this.dataStyle) }, this.elements.map((v) => v.render())));
    }
}
//# sourceMappingURL=root.js.map