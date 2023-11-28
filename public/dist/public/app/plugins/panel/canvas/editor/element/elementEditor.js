import { get as lodashGet } from 'lodash';
import { canvasElementRegistry, DEFAULT_CANVAS_ELEMENT_CONFIG, defaultElementItems, } from 'app/features/canvas';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';
import { getElementTypes } from '../../utils';
import { optionBuilder } from '../options';
import { PlacementEditor } from './PlacementEditor';
export function getElementEditor(opts) {
    return {
        category: opts.category,
        path: '--',
        // Note that canvas editor writes things to the scene!
        values: (parent) => ({
            getValue: (path) => {
                return lodashGet(opts.element.options, path);
            },
            onChange: (path, value) => {
                let options = opts.element.options;
                if (path === 'type' && value) {
                    const layer = canvasElementRegistry.getIfExists(value);
                    if (!layer) {
                        console.warn('layer does not exist', value);
                        return;
                    }
                    options = Object.assign(Object.assign(Object.assign({}, options), layer.getNewOptions(options)), { type: layer.id });
                }
                else {
                    options = setOptionImmutably(options, path, value);
                }
                opts.element.onChange(options);
                opts.element.updateData(opts.scene.context);
            },
        }),
        // Dynamically fill the selected element
        build: (builder, context) => {
            var _a, _b, _c, _d, _e, _f, _g;
            const { options } = opts.element;
            const current = (options === null || options === void 0 ? void 0 : options.type) ? options.type : DEFAULT_CANVAS_ELEMENT_CONFIG.type;
            const layerTypes = getElementTypes(opts.scene.shouldShowAdvancedTypes, current).options;
            const isUnsupported = !opts.scene.shouldShowAdvancedTypes && !defaultElementItems.filter((item) => item.id === (options === null || options === void 0 ? void 0 : options.type)).length;
            builder.addSelect({
                path: 'type',
                name: undefined,
                settings: {
                    options: layerTypes,
                },
                description: isUnsupported
                    ? 'Selected element type is not supported by current settings. Please enable advanced element types.'
                    : '',
            });
            // force clean layer configuration
            const layer = canvasElementRegistry.getIfExists((_a = options === null || options === void 0 ? void 0 : options.type) !== null && _a !== void 0 ? _a : DEFAULT_CANVAS_ELEMENT_CONFIG.type);
            let currentOptions = options;
            if (!currentOptions) {
                currentOptions = Object.assign(Object.assign({}, layer.getNewOptions(options)), { type: layer.id, name: `Element ${Date.now()}.${Math.floor(Math.random() * 100)}` });
            }
            const ctx = Object.assign(Object.assign({}, context), { options: currentOptions });
            if (layer === null || layer === void 0 ? void 0 : layer.registerOptionsUI) {
                layer.registerOptionsUI(builder, ctx);
            }
            const shouldAddLayoutEditor = (_c = (_b = opts.element.item.standardEditorConfig) === null || _b === void 0 ? void 0 : _b.layout) !== null && _c !== void 0 ? _c : true;
            if (shouldAddLayoutEditor) {
                builder.addCustomEditor({
                    category: ['Layout'],
                    id: 'content',
                    path: '__',
                    name: 'Quick placement',
                    editor: PlacementEditor,
                    settings: opts,
                });
            }
            const shouldAddBackgroundEditor = (_e = (_d = opts.element.item.standardEditorConfig) === null || _d === void 0 ? void 0 : _d.background) !== null && _e !== void 0 ? _e : true;
            if (shouldAddBackgroundEditor) {
                optionBuilder.addBackground(builder, ctx);
            }
            const shouldAddBorderEditor = (_g = (_f = opts.element.item.standardEditorConfig) === null || _f === void 0 ? void 0 : _f.border) !== null && _g !== void 0 ? _g : true;
            if (shouldAddBorderEditor) {
                optionBuilder.addBorder(builder, ctx);
            }
        },
    };
}
//# sourceMappingURL=elementEditor.js.map