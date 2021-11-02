import { PanelPlugin } from '@grafana/data';
import { CanvasPanel } from './CanvasPanel';
import { getElementEditor } from './editor/elementEditor';
import { getLayerEditor } from './editor/layerEditor';
export var plugin = new PanelPlugin(CanvasPanel)
    .setNoPadding() // extend to panel edges
    .useFieldConfig()
    .setPanelOptions(function (builder, context) {
    var state = context.instanceState;
    builder.addBooleanSwitch({
        path: 'inlineEditing',
        name: 'Inline editing',
        description: 'Enable editing the panel directly',
        defaultValue: true,
    });
    if (state) {
        var selection = state.selected;
        if ((selection === null || selection === void 0 ? void 0 : selection.length) === 1) {
            builder.addNestedOptions(getElementEditor({
                category: ["Selected element (id: " + selection[0].UID + ")"],
                element: selection[0],
                scene: state.scene,
            }));
        }
        builder.addNestedOptions(getLayerEditor(state));
    }
});
//# sourceMappingURL=module.js.map