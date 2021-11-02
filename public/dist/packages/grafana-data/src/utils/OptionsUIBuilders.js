import { __assign, __extends } from "tslib";
import { OptionsUIRegistryBuilder } from '../types/OptionsUIRegistryBuilder';
import { numberOverrideProcessor, selectOverrideProcessor, stringOverrideProcessor, booleanOverrideProcessor, standardEditorsRegistry, identityOverrideProcessor, unitOverrideProcessor, } from '../field';
/**
 * Fluent API for declarative creation of field config option editors
 */
var FieldConfigEditorBuilder = /** @class */ (function (_super) {
    __extends(FieldConfigEditorBuilder, _super);
    function FieldConfigEditorBuilder() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    FieldConfigEditorBuilder.prototype.addNumberInput = function (config) {
        var _a;
        return this.addCustomEditor(__assign(__assign({}, config), { id: config.path, override: standardEditorsRegistry.get('number').editor, editor: standardEditorsRegistry.get('number').editor, process: numberOverrideProcessor, shouldApply: (_a = config.shouldApply) !== null && _a !== void 0 ? _a : (function () { return true; }), settings: config.settings || {} }));
    };
    FieldConfigEditorBuilder.prototype.addSliderInput = function (config) {
        var _a;
        return this.addCustomEditor(__assign(__assign({}, config), { id: config.path, override: standardEditorsRegistry.get('slider').editor, editor: standardEditorsRegistry.get('slider').editor, process: numberOverrideProcessor, shouldApply: (_a = config.shouldApply) !== null && _a !== void 0 ? _a : (function () { return true; }), settings: config.settings || {} }));
    };
    FieldConfigEditorBuilder.prototype.addTextInput = function (config) {
        var _a;
        return this.addCustomEditor(__assign(__assign({}, config), { id: config.path, override: standardEditorsRegistry.get('text').editor, editor: standardEditorsRegistry.get('text').editor, process: stringOverrideProcessor, shouldApply: (_a = config.shouldApply) !== null && _a !== void 0 ? _a : (function () { return true; }), settings: config.settings || {} }));
    };
    FieldConfigEditorBuilder.prototype.addSelect = function (config) {
        return this.addCustomEditor(__assign(__assign({}, config), { id: config.path, override: standardEditorsRegistry.get('select').editor, editor: standardEditorsRegistry.get('select').editor, process: selectOverrideProcessor, 
            // ???
            shouldApply: config.shouldApply ? config.shouldApply : function () { return true; }, settings: config.settings || { options: [] } }));
    };
    FieldConfigEditorBuilder.prototype.addRadio = function (config) {
        return this.addCustomEditor(__assign(__assign({}, config), { id: config.path, override: standardEditorsRegistry.get('radio').editor, editor: standardEditorsRegistry.get('radio').editor, process: selectOverrideProcessor, 
            // ???
            shouldApply: config.shouldApply ? config.shouldApply : function () { return true; }, settings: config.settings || { options: [] } }));
    };
    FieldConfigEditorBuilder.prototype.addBooleanSwitch = function (config) {
        return this.addCustomEditor(__assign(__assign({}, config), { id: config.path, editor: standardEditorsRegistry.get('boolean').editor, override: standardEditorsRegistry.get('boolean').editor, process: booleanOverrideProcessor, shouldApply: config.shouldApply ? config.shouldApply : function () { return true; }, settings: config.settings || {} }));
    };
    FieldConfigEditorBuilder.prototype.addColorPicker = function (config) {
        return this.addCustomEditor(__assign(__assign({}, config), { id: config.path, editor: standardEditorsRegistry.get('color').editor, override: standardEditorsRegistry.get('color').editor, process: identityOverrideProcessor, shouldApply: config.shouldApply ? config.shouldApply : function () { return true; }, settings: config.settings || {} }));
    };
    FieldConfigEditorBuilder.prototype.addUnitPicker = function (config) {
        return this.addCustomEditor(__assign(__assign({}, config), { id: config.path, editor: standardEditorsRegistry.get('unit').editor, override: standardEditorsRegistry.get('unit').editor, process: unitOverrideProcessor, shouldApply: config.shouldApply ? config.shouldApply : function () { return true; }, settings: config.settings || {} }));
    };
    return FieldConfigEditorBuilder;
}(OptionsUIRegistryBuilder));
export { FieldConfigEditorBuilder };
var NestedPanelOptionsBuilder = /** @class */ (function () {
    function NestedPanelOptionsBuilder(cfg) {
        var _this = this;
        this.cfg = cfg;
        this.path = '';
        this.id = 'nested-panel-options';
        this.name = 'nested';
        this.editor = function () { return null; };
        this.getBuilder = function () {
            return _this.cfg.build;
        };
        this.getNestedValueAccess = function (parent) {
            var values = _this.cfg.values;
            if (values) {
                return values(parent);
            }
            // by default prefix the path
            return {
                getValue: function (path) { return parent.getValue(_this.path + "." + path); },
                onChange: function (path, value) { return parent.onChange(_this.path + "." + path, value); },
            };
        };
        this.path = cfg.path;
        this.category = cfg.category;
        this.defaultValue = cfg.defaultValue;
    }
    return NestedPanelOptionsBuilder;
}());
export { NestedPanelOptionsBuilder };
export function isNestedPanelOptions(item) {
    return item.id === 'nested-panel-options';
}
/**
 * Fluent API for declarative creation of panel options
 */
var PanelOptionsEditorBuilder = /** @class */ (function (_super) {
    __extends(PanelOptionsEditorBuilder, _super);
    function PanelOptionsEditorBuilder() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    PanelOptionsEditorBuilder.prototype.addNestedOptions = function (opts) {
        var s = new NestedPanelOptionsBuilder(opts);
        return this.addCustomEditor(s);
    };
    PanelOptionsEditorBuilder.prototype.addNumberInput = function (config) {
        return this.addCustomEditor(__assign(__assign({}, config), { id: config.path, editor: standardEditorsRegistry.get('number').editor }));
    };
    PanelOptionsEditorBuilder.prototype.addSliderInput = function (config) {
        return this.addCustomEditor(__assign(__assign({}, config), { id: config.path, editor: standardEditorsRegistry.get('slider').editor }));
    };
    PanelOptionsEditorBuilder.prototype.addTextInput = function (config) {
        return this.addCustomEditor(__assign(__assign({}, config), { id: config.path, editor: standardEditorsRegistry.get('text').editor }));
    };
    PanelOptionsEditorBuilder.prototype.addStringArray = function (config) {
        return this.addCustomEditor(__assign(__assign({}, config), { id: config.path, editor: standardEditorsRegistry.get('strings').editor }));
    };
    PanelOptionsEditorBuilder.prototype.addSelect = function (config) {
        return this.addCustomEditor(__assign(__assign({}, config), { id: config.path, editor: standardEditorsRegistry.get('select').editor }));
    };
    PanelOptionsEditorBuilder.prototype.addMultiSelect = function (config) {
        return this.addCustomEditor(__assign(__assign({}, config), { id: config.path, editor: standardEditorsRegistry.get('multi-select').editor }));
    };
    PanelOptionsEditorBuilder.prototype.addRadio = function (config) {
        return this.addCustomEditor(__assign(__assign({}, config), { id: config.path, editor: standardEditorsRegistry.get('radio').editor }));
    };
    PanelOptionsEditorBuilder.prototype.addBooleanSwitch = function (config) {
        return this.addCustomEditor(__assign(__assign({}, config), { id: config.path, editor: standardEditorsRegistry.get('boolean').editor }));
    };
    PanelOptionsEditorBuilder.prototype.addColorPicker = function (config) {
        return this.addCustomEditor(__assign(__assign({}, config), { id: config.path, editor: standardEditorsRegistry.get('color').editor, settings: config.settings || {} }));
    };
    PanelOptionsEditorBuilder.prototype.addTimeZonePicker = function (config) {
        return this.addCustomEditor(__assign(__assign({}, config), { id: config.path, editor: standardEditorsRegistry.get('timezone').editor, settings: config.settings || {} }));
    };
    PanelOptionsEditorBuilder.prototype.addUnitPicker = function (config) {
        return this.addCustomEditor(__assign(__assign({}, config), { id: config.path, editor: standardEditorsRegistry.get('unit').editor }));
    };
    PanelOptionsEditorBuilder.prototype.addFieldNamePicker = function (config) {
        return this.addCustomEditor(__assign(__assign({}, config), { id: config.path, editor: standardEditorsRegistry.get('field-name').editor }));
    };
    PanelOptionsEditorBuilder.prototype.addDashboardPicker = function (config) {
        return this.addCustomEditor(__assign(__assign({}, config), { id: config.path, editor: standardEditorsRegistry.get('dashboard-uid').editor }));
    };
    return PanelOptionsEditorBuilder;
}(OptionsUIRegistryBuilder));
export { PanelOptionsEditorBuilder };
//# sourceMappingURL=OptionsUIBuilders.js.map