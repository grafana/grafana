import { get as lodashGet } from 'lodash';
import { FrameState } from 'app/features/canvas/runtime/frame';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';
import { PlacementEditor } from '../element/PlacementEditor';
import { optionBuilder } from '../options';
import { TreeNavigationEditor } from './TreeNavigationEditor';
export function getLayerEditor(opts) {
    const { selected, scene } = opts;
    if (!scene.currentLayer) {
        scene.currentLayer = scene.root;
    }
    if (selected) {
        for (const element of selected) {
            if (element instanceof FrameState) {
                scene.currentLayer = element;
                break;
            }
            if (element && element.parent) {
                scene.currentLayer = element.parent;
                break;
            }
        }
    }
    const options = scene.currentLayer.options || { elements: [] };
    return {
        category: ['Layer'],
        path: '--',
        // Note that canvas editor writes things to the scene!
        values: (parent) => ({
            getValue: (path) => {
                return lodashGet(options, path);
            },
            onChange: (path, value) => {
                var _a, _b;
                if (path === 'type' && value) {
                    console.warn('unable to change layer type');
                    return;
                }
                const c = setOptionImmutably(options, path, value);
                (_a = scene.currentLayer) === null || _a === void 0 ? void 0 : _a.onChange(c);
                (_b = scene.currentLayer) === null || _b === void 0 ? void 0 : _b.updateData(scene.context);
            },
        }),
        // Dynamically fill the selected element
        build: (builder, context) => {
            const currentLayer = scene.currentLayer;
            if (currentLayer && !currentLayer.isRoot()) {
                // TODO: the non-root nav option
            }
            builder.addCustomEditor({
                id: 'content',
                path: 'root',
                name: 'Elements',
                editor: TreeNavigationEditor,
                settings: { scene, layer: scene.currentLayer, selected },
            });
            const ctx = Object.assign(Object.assign({}, context), { options });
            optionBuilder.addBackground(builder, ctx);
            optionBuilder.addBorder(builder, ctx);
            if (currentLayer && !currentLayer.isRoot()) {
                builder.addCustomEditor({
                    category: ['Layout'],
                    id: 'content',
                    path: '__',
                    name: 'Constraints',
                    editor: PlacementEditor,
                    settings: {
                        scene: opts.scene,
                        element: currentLayer,
                    },
                });
            }
        },
    };
}
//# sourceMappingURL=layerEditor.js.map