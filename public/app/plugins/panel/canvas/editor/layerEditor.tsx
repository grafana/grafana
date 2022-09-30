import { get as lodashGet } from 'lodash';

import { NestedPanelOptions, NestedValueAccess } from '@grafana/data/src/utils/OptionsUIBuilders';
import { ElementState } from 'app/features/canvas/runtime/element';
import { FrameState } from 'app/features/canvas/runtime/frame';
import { Scene } from 'app/features/canvas/runtime/scene';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';

import { InstanceState } from '../CanvasPanel';

import { PlacementEditor } from './PlacementEditor';
import { TreeNavigationEditor } from './TreeNavigationEditor';
import { optionBuilder } from './options';

export interface LayerEditorProps {
  scene: Scene;
  layer: FrameState;
  selected: ElementState[];
}

export function getLayerEditor(opts: InstanceState): NestedPanelOptions<LayerEditorProps> {
  const { selected, scene } = opts;

  if (!scene.currentLayer) {
    scene.currentLayer = scene.root as FrameState;
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
        scene.currentLayer?.updateData(scene.context);
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

      const ctx = { ...context, options };
      optionBuilder.addBackground(builder as any, ctx);
      optionBuilder.addBorder(builder as any, ctx);

      if (currentLayer && !currentLayer.isRoot()) {
        builder.addCustomEditor({
          category: ['Layout'],
          id: 'content',
          path: '__', // not used
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
