import { __assign, __extends, __read, __values } from "tslib";
import React from 'react';
import { canvasElementRegistry } from 'app/features/canvas';
import { notFoundItem } from 'app/features/canvas/elements/notFound';
import { ElementState } from './element';
import { LayerActionID } from 'app/plugins/panel/canvas/types';
import { cloneDeep } from 'lodash';
export var groupItemDummy = {
    id: 'group',
    name: 'Group',
    description: 'Group',
    getNewOptions: function () { return ({
        config: {},
    }); },
    // eslint-disable-next-line react/display-name
    display: function () {
        return React.createElement("div", null, "GROUP!");
    },
};
var GroupState = /** @class */ (function (_super) {
    __extends(GroupState, _super);
    function GroupState(options, scene, parent) {
        var e_1, _a;
        var _b;
        var _this = _super.call(this, groupItemDummy, options, parent) || this;
        _this.options = options;
        _this.parent = parent;
        _this.elements = [];
        // ??? or should this be on the element directly?
        // are actions scoped to layers?
        _this.doAction = function (action, element) {
            switch (action) {
                case LayerActionID.Delete:
                    _this.elements = _this.elements.filter(function (e) { return e !== element; });
                    _this.scene.save();
                    _this.reinitializeMoveable();
                    break;
                case LayerActionID.Duplicate:
                    if (element.item.id === 'group') {
                        console.log('Can not duplicate groups (yet)', action, element);
                        return;
                    }
                    var opts = cloneDeep(element.options);
                    if (element.anchor.top) {
                        opts.placement.top += 10;
                    }
                    if (element.anchor.left) {
                        opts.placement.left += 10;
                    }
                    if (element.anchor.bottom) {
                        opts.placement.bottom += 10;
                    }
                    if (element.anchor.right) {
                        opts.placement.right += 10;
                    }
                    var copy = new ElementState(element.item, opts, _this);
                    copy.updateSize(element.width, element.height);
                    copy.updateData(_this.scene.context);
                    _this.elements.push(copy);
                    _this.scene.save();
                    _this.reinitializeMoveable();
                    break;
                default:
                    console.log('DO action', action, element);
                    return;
            }
        };
        _this.scene = scene;
        // mutate options object
        var elements = _this.options.elements;
        if (!elements) {
            _this.options.elements = elements = [];
        }
        try {
            for (var elements_1 = __values(elements), elements_1_1 = elements_1.next(); !elements_1_1.done; elements_1_1 = elements_1.next()) {
                var c = elements_1_1.value;
                if (c.type === 'group') {
                    _this.elements.push(new GroupState(c, scene, _this));
                }
                else {
                    var item = (_b = canvasElementRegistry.getIfExists(c.type)) !== null && _b !== void 0 ? _b : notFoundItem;
                    _this.elements.push(new ElementState(item, c, _this));
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (elements_1_1 && !elements_1_1.done && (_a = elements_1.return)) _a.call(elements_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return _this;
    }
    GroupState.prototype.isRoot = function () {
        return false;
    };
    // The parent size, need to set our own size based on offsets
    GroupState.prototype.updateSize = function (width, height) {
        var e_2, _a;
        _super.prototype.updateSize.call(this, width, height);
        if (!this.parent) {
            this.width = width;
            this.height = height;
            this.sizeStyle.width = width;
            this.sizeStyle.height = height;
        }
        try {
            // Update children with calculated size
            for (var _b = __values(this.elements), _c = _b.next(); !_c.done; _c = _b.next()) {
                var elem = _c.value;
                elem.updateSize(this.width, this.height);
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
        // The group forced to full width (for now)
        this.sizeStyle.width = width;
        this.sizeStyle.height = height;
        this.sizeStyle.position = 'absolute';
    };
    GroupState.prototype.updateData = function (ctx) {
        var e_3, _a;
        _super.prototype.updateData.call(this, ctx);
        try {
            for (var _b = __values(this.elements), _c = _b.next(); !_c.done; _c = _b.next()) {
                var elem = _c.value;
                elem.updateData(ctx);
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_3) throw e_3.error; }
        }
    };
    // used in the layer editor
    GroupState.prototype.reorder = function (startIndex, endIndex) {
        var result = Array.from(this.elements);
        var _a = __read(result.splice(startIndex, 1), 1), removed = _a[0];
        result.splice(endIndex, 0, removed);
        this.elements = result;
        this.reinitializeMoveable();
    };
    GroupState.prototype.reinitializeMoveable = function () {
        var _this = this;
        // Need to first clear current selection and then re-init moveable with slight delay
        this.scene.clearCurrentSelection();
        setTimeout(function () { return _this.scene.initMoveable(true); }, 100);
    };
    GroupState.prototype.render = function () {
        return (React.createElement("div", { key: this.UID + "/" + this.revId, style: __assign(__assign({}, this.sizeStyle), this.dataStyle) }, this.elements.map(function (v) { return v.render(); })));
    };
    /** Recursively visit all nodes */
    GroupState.prototype.visit = function (visitor) {
        var e_4, _a;
        _super.prototype.visit.call(this, visitor);
        try {
            for (var _b = __values(this.elements), _c = _b.next(); !_c.done; _c = _b.next()) {
                var e = _c.value;
                visitor(e);
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_4) throw e_4.error; }
        }
    };
    GroupState.prototype.getSaveModel = function () {
        return __assign(__assign({}, this.options), { elements: this.elements.map(function (v) { return v.getSaveModel(); }) });
    };
    return GroupState;
}(ElementState));
export { GroupState };
//# sourceMappingURL=group.js.map