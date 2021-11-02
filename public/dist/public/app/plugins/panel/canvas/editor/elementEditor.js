import { __assign } from "tslib";
import { get as lodashGet } from 'lodash';
import { optionBuilder } from './options';
import { canvasElementRegistry, DEFAULT_CANVAS_ELEMENT_CONFIG } from 'app/features/canvas';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';
import { PlacementEditor } from './PlacementEditor';
export function getElementEditor(opts) {
    return {
        category: opts.category,
        path: '--',
        // Note that canvas editor writes things to the scene!
        values: function (parent) { return ({
            getValue: function (path) {
                return lodashGet(opts.element.options, path);
            },
            onChange: function (path, value) {
                var options = opts.element.options;
                if (path === 'type' && value) {
                    var layer = canvasElementRegistry.getIfExists(value);
                    if (!layer) {
                        console.warn('layer does not exist', value);
                        return;
                    }
                    options = __assign(__assign(__assign({}, options), layer.getNewOptions(options)), { type: layer.id });
                }
                else {
                    options = setOptionImmutably(options, path, value);
                }
                opts.element.onChange(options);
                opts.element.updateData(opts.scene.context);
            },
        }); },
        // Dynamically fill the selected element
        build: function (builder, context) {
            var _a;
            var options = opts.element.options;
            var layerTypes = canvasElementRegistry.selectOptions((options === null || options === void 0 ? void 0 : options.type // the selected value
            )
                ? [options.type] // as an array
                : [DEFAULT_CANVAS_ELEMENT_CONFIG.type]);
            builder.addSelect({
                path: 'type',
                name: undefined,
                settings: {
                    options: layerTypes.options,
                },
            });
            // force clean layer configuration
            var layer = canvasElementRegistry.getIfExists((_a = options === null || options === void 0 ? void 0 : options.type) !== null && _a !== void 0 ? _a : DEFAULT_CANVAS_ELEMENT_CONFIG.type);
            var currentOptions = options;
            if (!currentOptions) {
                currentOptions = __assign(__assign({}, layer.getNewOptions(options)), { type: layer.id });
            }
            var ctx = __assign(__assign({}, context), { options: currentOptions });
            if (layer.registerOptionsUI) {
                layer.registerOptionsUI(builder, ctx);
            }
            optionBuilder.addBackground(builder, ctx);
            optionBuilder.addBorder(builder, ctx);
            builder.addCustomEditor({
                category: ['Layout'],
                id: 'content',
                path: '__',
                name: 'Anchor',
                editor: PlacementEditor,
                settings: opts,
            });
        },
    };
}
//# sourceMappingURL=elementEditor.js.map