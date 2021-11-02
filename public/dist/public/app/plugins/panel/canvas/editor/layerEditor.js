import { __assign } from "tslib";
import { get as lodashGet } from 'lodash';
import { optionBuilder } from './options';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';
import { LayerElementListEditor } from './LayerElementListEditor';
export function getLayerEditor(opts) {
    var layer = opts.layer;
    var options = layer.options || { elements: [] };
    return {
        category: ['Layer'],
        path: '--',
        // Note that canvas editor writes things to the scene!
        values: function (parent) { return ({
            getValue: function (path) {
                return lodashGet(options, path);
            },
            onChange: function (path, value) {
                if (path === 'type' && value) {
                    console.warn('unable to change layer type');
                    return;
                }
                var c = setOptionImmutably(options, path, value);
                layer.onChange(c);
            },
        }); },
        // Dynamically fill the selected element
        build: function (builder, context) {
            builder.addCustomEditor({
                id: 'content',
                path: 'root',
                name: 'Elements',
                editor: LayerElementListEditor,
                settings: opts,
            });
            // // force clean layer configuration
            // const layer = canvasElementRegistry.getIfExists(options?.type ?? DEFAULT_CANVAS_ELEMENT_CONFIG.type)!;
            //const currentOptions = { ...options, type: layer.id, config: { ...layer.defaultConfig, ...options?.config } };
            var ctx = __assign(__assign({}, context), { options: options });
            // if (layer.registerOptionsUI) {
            //   layer.registerOptionsUI(builder, ctx);
            // }
            optionBuilder.addBackground(builder, ctx);
            optionBuilder.addBorder(builder, ctx);
        },
    };
}
//# sourceMappingURL=layerEditor.js.map