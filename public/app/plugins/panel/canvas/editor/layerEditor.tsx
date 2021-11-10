import { get as lodashGet } from 'lodash';
import { optionBuilder } from './options';
import { NestedPanelOptions, NestedValueAccess } from '@grafana/data/src/utils/OptionsUIBuilders';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';
import { InstanceState } from '../CanvasPanel';
import { LayerElementListEditor } from './LayerElementListEditor';
import { GroupState } from 'app/features/canvas/runtime/group';
import { Scene } from 'app/features/canvas/runtime/scene';
import { ElementState } from 'app/features/canvas/runtime/element';

export interface LayerEditorProps {
  scene: Scene;
  layer: GroupState;
  selected: ElementState[];
}

export function getLayerEditor(opts: InstanceState): NestedPanelOptions<LayerEditorProps> {
  const { selected, scene } = opts;

  if (!scene.currentLayer) {
    scene.currentLayer = scene.root as GroupState;
  }

  if (selected) {
    for (const element of selected) {
      if (element instanceof GroupState) {
        scene.currentLayer = element;
        break;
      }

      if (element.parent) {
        scene.currentLayer = element.parent;
        break;
      }
    }
  }

  const options = scene.currentLayer.options || { elements: [] };

  return {
    category: ['Layer'],
    path: '--', // not used!

    // Note that canvas editor writes things to the scene!
    values: (parent: NestedValueAccess) => ({
      getValue: (path: string) => {
        return lodashGet(options, path);
      },
      onChange: (path: string, value: any) => {
        if (path === 'type' && value) {
          console.warn('unable to change layer type');
          return;
        }
        const c = setOptionImmutably(options, path, value);
        scene.currentLayer?.onChange(c);
      },
    }),

    // Dynamically fill the selected element
    build: (builder, context) => {
      builder.addCustomEditor({
        id: 'content',
        path: 'root',
        name: 'Elements',
        editor: LayerElementListEditor,
        settings: { scene, layer: scene.currentLayer, selected },
      });

      // // force clean layer configuration
      // const layer = canvasElementRegistry.getIfExists(options?.type ?? DEFAULT_CANVAS_ELEMENT_CONFIG.type)!;
      //const currentOptions = { ...options, type: layer.id, config: { ...layer.defaultConfig, ...options?.config } };
      const ctx = { ...context, options };

      // if (layer.registerOptionsUI) {
      //   layer.registerOptionsUI(builder, ctx);
      // }

      optionBuilder.addBackground(builder as any, ctx);
      optionBuilder.addBorder(builder as any, ctx);
    },
  };
}
