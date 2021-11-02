import { __assign, __extends, __rest } from "tslib";
import { GroupState } from './group';
var RootElement = /** @class */ (function (_super) {
    __extends(RootElement, _super);
    function RootElement(options, scene, changeCallback) {
        var _this = _super.call(this, options, scene) || this;
        _this.options = options;
        _this.scene = scene;
        _this.changeCallback = changeCallback;
        return _this;
    }
    RootElement.prototype.isRoot = function () {
        return true;
    };
    // The parent size is always fullsize
    RootElement.prototype.updateSize = function (width, height) {
        _super.prototype.updateSize.call(this, width, height);
        this.width = width;
        this.height = height;
        this.sizeStyle.width = width;
        this.sizeStyle.height = height;
    };
    // root type can not change
    RootElement.prototype.onChange = function (options) {
        this.revId++;
        this.options = __assign({}, options);
        this.changeCallback();
    };
    RootElement.prototype.getSaveModel = function () {
        var _a = this.options, placement = _a.placement, anchor = _a.anchor, rest = __rest(_a, ["placement", "anchor"]);
        return __assign(__assign({}, rest), { elements: this.elements.map(function (v) { return v.getSaveModel(); }) });
    };
    return RootElement;
}(GroupState));
export { RootElement };
//# sourceMappingURL=root.js.map