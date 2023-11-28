import { FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { FrameState } from 'app/features/canvas/runtime/frame';
import { CanvasPanel } from './CanvasPanel';
import { getConnectionEditor } from './editor/connectionEditor';
import { getElementEditor } from './editor/element/elementEditor';
import { getLayerEditor } from './editor/layer/layerEditor';
import { canvasMigrationHandler } from './migrations';
export const addStandardCanvasEditorOptions = (builder) => {
    builder.addBooleanSwitch({
        path: 'inlineEditing',
        name: 'Inline editing',
        description: 'Enable editing the panel directly',
        defaultValue: true,
    });
    builder.addBooleanSwitch({
        path: 'showAdvancedTypes',
        name: 'Experimental element types',
        description: 'Enable selection of experimental element types',
        defaultValue: true,
    });
};
export const plugin = new PanelPlugin(CanvasPanel)
    .setNoPadding() // extend to panel edges
    .useFieldConfig({
    standardOptions: {
        [FieldConfigProperty.Mappings]: {
            settings: {
                icon: true,
            },
        },
    },
})
    .setMigrationHandler(canvasMigrationHandler)
    .setPanelOptions((builder, context) => {
    const state = context.instanceState;
    addStandardCanvasEditorOptions(builder);
    if (state) {
        builder.addNestedOptions(getLayerEditor(state));
        const selection = state.selected;
        const connectionSelection = state.selectedConnection;
        if ((selection === null || selection === void 0 ? void 0 : selection.length) === 1) {
            const element = selection[0];
            if (!(element instanceof FrameState)) {
                builder.addNestedOptions(getElementEditor({
                    category: [`Selected element (${element.options.name})`],
                    element,
                    scene: state.scene,
                }));
            }
        }
        if (connectionSelection) {
            builder.addNestedOptions(getConnectionEditor({
                category: ['Selected connection'],
                connection: connectionSelection,
                scene: state.scene,
            }));
        }
    }
});
//# sourceMappingURL=module.js.map