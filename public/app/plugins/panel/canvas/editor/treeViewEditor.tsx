import { NestedPanelOptions } from '@grafana/data/src/utils/OptionsUIBuilders';
import { ElementState } from 'app/features/canvas/runtime/element';
import { FrameState } from 'app/features/canvas/runtime/frame';
import { Scene } from 'app/features/canvas/runtime/scene';

import { InstanceState } from '../CanvasPanel';

import { TreeNavigationEditor } from './TreeNavigationEditor';

export interface TreeViewEditorProps {
  scene: Scene;
  layer: FrameState;
  selected: ElementState[];
}

export function getTreeViewEditor(opts: InstanceState): NestedPanelOptions<TreeViewEditorProps> {
  const { selected, scene } = opts;

  if (selected) {
    for (const element of selected) {
      if (element instanceof FrameState) {
        scene.currentLayer = element;
        break;
      }

      if (element.parent) {
        scene.currentLayer = element.parent;
        break;
      }
    }
  }

  return {
    category: ['Tree View'],
    path: '--',
    build: (builder, context) => {
      builder.addCustomEditor({
        category: [],
        id: 'treeView',
        path: '__', // not used
        name: '',
        editor: TreeNavigationEditor,
        settings: { scene, layer: scene.currentLayer, selected },
      });
    },
  };
}
