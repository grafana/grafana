import { __assign, __extends, __values } from "tslib";
import { GrafanaPlugin, } from '../types';
import { PanelOptionsEditorBuilder } from '../utils/OptionsUIBuilders';
import { set } from 'lodash';
import { deprecationWarning } from '../utils';
import { FieldConfigOptionsRegistry } from '../field';
import { createFieldConfigRegistry } from './registryFactories';
var PanelPlugin = /** @class */ (function (_super) {
    __extends(PanelPlugin, _super);
    function PanelPlugin(panel) {
        var _this = _super.call(this) || this;
        _this._fieldConfigDefaults = {
            defaults: {},
            overrides: [],
        };
        _this._initConfigRegistry = function () {
            return new FieldConfigOptionsRegistry();
        };
        _this.dataSupport = {
            annotations: false,
            alertStates: false,
        };
        _this.panel = panel;
        return _this;
    }
    Object.defineProperty(PanelPlugin.prototype, "defaults", {
        get: function () {
            var e_1, _a;
            var result = this._defaults || {};
            if (!this._defaults && this.optionsSupplier) {
                var builder = new PanelOptionsEditorBuilder();
                this.optionsSupplier(builder, { data: [] });
                try {
                    for (var _b = __values(builder.getItems()), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var item = _c.value;
                        if (item.defaultValue != null) {
                            set(result, item.path, item.defaultValue);
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            }
            return result;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PanelPlugin.prototype, "fieldConfigDefaults", {
        get: function () {
            var e_2, _a;
            var configDefaults = this._fieldConfigDefaults.defaults;
            configDefaults.custom = {};
            try {
                for (var _b = __values(this.fieldConfigRegistry.list()), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var option = _c.value;
                    if (option.defaultValue === undefined) {
                        continue;
                    }
                    set(configDefaults, option.id, option.defaultValue);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_2) throw e_2.error; }
            }
            return {
                defaults: __assign({}, configDefaults),
                overrides: this._fieldConfigDefaults.overrides,
            };
        },
        enumerable: false,
        configurable: true
    });
    /**
     * @deprecated setDefaults is deprecated in favor of setPanelOptions
     */
    PanelPlugin.prototype.setDefaults = function (defaults) {
        deprecationWarning('PanelPlugin', 'setDefaults', 'setPanelOptions');
        this._defaults = defaults;
        return this;
    };
    Object.defineProperty(PanelPlugin.prototype, "fieldConfigRegistry", {
        get: function () {
            if (!this._fieldConfigRegistry) {
                this._fieldConfigRegistry = this._initConfigRegistry();
            }
            return this._fieldConfigRegistry;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * @deprecated setEditor is deprecated in favor of setPanelOptions
     */
    PanelPlugin.prototype.setEditor = function (editor) {
        deprecationWarning('PanelPlugin', 'setEditor', 'setPanelOptions');
        this.editor = editor;
        return this;
    };
    PanelPlugin.prototype.setNoPadding = function () {
        this.noPadding = true;
        return this;
    };
    /**
     * This function is called before the panel first loads if
     * the current version is different than the version that was saved.
     *
     * This is a good place to support any changes to the options model
     */
    PanelPlugin.prototype.setMigrationHandler = function (handler) {
        this.onPanelMigration = handler;
        return this;
    };
    /**
     * This function is called when the visualization was changed. This
     * passes in the panel model for previous visualisation options inspection
     * and panel model updates.
     *
     * This is useful for supporting PanelModel API updates when changing
     * between Angular and React panels.
     */
    PanelPlugin.prototype.setPanelChangeHandler = function (handler) {
        this.onPanelTypeChanged = handler;
        return this;
    };
    /**
     * Enables panel options editor creation
     *
     * @example
     * ```typescript
     *
     * import { ShapePanel } from './ShapePanel';
     *
     * interface ShapePanelOptions {}
     *
     * export const plugin = new PanelPlugin<ShapePanelOptions>(ShapePanel)
     *   .setPanelOptions(builder => {
     *     builder
     *       .addSelect({
     *         id: 'shape',
     *         name: 'Shape',
     *         description: 'Select shape to render'
     *         settings: {
     *           options: [
     *             {value: 'circle', label: 'Circle' },
     *             {value: 'square', label: 'Square },
     *             {value: 'triangle', label: 'Triangle }
     *            ]
     *         },
     *       })
     *   })
     * ```
     *
     * @public
     **/
    PanelPlugin.prototype.setPanelOptions = function (builder) {
        // builder is applied lazily when options UI is created
        this.optionsSupplier = builder;
        return this;
    };
    /**
     * This is used while building the panel options editor.
     *
     * @internal
     */
    PanelPlugin.prototype.getPanelOptionsSupplier = function () {
        var _a;
        return (_a = this.optionsSupplier) !== null && _a !== void 0 ? _a : (function () { });
    };
    /**
     * Tells Grafana if the plugin should subscribe to annotation and alertState results.
     *
     * @example
     * ```typescript
     *
     * import { ShapePanel } from './ShapePanel';
     *
     * interface ShapePanelOptions {}
     *
     * export const plugin = new PanelPlugin<ShapePanelOptions>(ShapePanel)
     *     .useFieldConfig({})
     *     ...
     *     ...
     *     .setDataSupport({
     *       annotations: true,
     *       alertStates: true,
     *     });
     * ```
     *
     * @public
     **/
    PanelPlugin.prototype.setDataSupport = function (support) {
        this.dataSupport = __assign(__assign({}, this.dataSupport), support);
        return this;
    };
    /**
     * Allows specifying which standard field config options panel should use and defining default values
     *
     * @example
     * ```typescript
     *
     * import { ShapePanel } from './ShapePanel';
     *
     * interface ShapePanelOptions {}
     *
     * // when plugin should use all standard options
     * export const plugin = new PanelPlugin<ShapePanelOptions>(ShapePanel)
     *  .useFieldConfig();
     *
     * // when plugin should only display specific standard options
     * // note, that options will be displayed in the order they are provided
     * export const plugin = new PanelPlugin<ShapePanelOptions>(ShapePanel)
     *  .useFieldConfig({
     *    standardOptions: [FieldConfigProperty.Min, FieldConfigProperty.Max]
     *   });
     *
     * // when standard option's default value needs to be provided
     * export const plugin = new PanelPlugin<ShapePanelOptions>(ShapePanel)
     *  .useFieldConfig({
     *    standardOptions: [FieldConfigProperty.Min, FieldConfigProperty.Max],
     *    standardOptionsDefaults: {
     *      [FieldConfigProperty.Min]: 20,
     *      [FieldConfigProperty.Max]: 100
     *    }
     *  });
     *
     * // when custom field config options needs to be provided
     * export const plugin = new PanelPlugin<ShapePanelOptions>(ShapePanel)
     *  .useFieldConfig({
     *    useCustomConfig: builder => {
     *      builder
     *       .addNumberInput({
     *         id: 'shapeBorderWidth',
     *         name: 'Border width',
     *         description: 'Border width of the shape',
     *         settings: {
     *           min: 1,
     *           max: 5,
     *         },
     *       })
     *       .addSelect({
     *         id: 'displayMode',
     *         name: 'Display mode',
     *         description: 'How the shape shout be rendered'
     *         settings: {
     *         options: [{value: 'fill', label: 'Fill' }, {value: 'transparent', label: 'Transparent }]
     *       },
     *     })
     *   },
     *  });
     *
     * ```
     *
     * @public
     */
    PanelPlugin.prototype.useFieldConfig = function (config) {
        var _this = this;
        if (config === void 0) { config = {}; }
        // builder is applied lazily when custom field configs are accessed
        this._initConfigRegistry = function () { return createFieldConfigRegistry(config, _this.meta.name); };
        return this;
    };
    /**
     * Sets function that can return visualization examples and suggestions.
     * @alpha
     */
    PanelPlugin.prototype.setSuggestionsSupplier = function (supplier) {
        this.suggestionsSupplier = supplier;
        return this;
    };
    /**
     * Returns the suggestions supplier
     * @alpha
     */
    PanelPlugin.prototype.getSuggestionsSupplier = function () {
        return this.suggestionsSupplier;
    };
    return PanelPlugin;
}(GrafanaPlugin));
export { PanelPlugin };
//# sourceMappingURL=PanelPlugin.js.map