import { AppEvents } from '@grafana/data/src';

import appEvents from '../../../core/app_events';
import { ElementState } from '../../../features/canvas/runtime/element';
import { FrameState } from '../../../features/canvas/runtime/frame';
import { SelectionParams } from '../../../features/canvas/runtime/scene';

import { TreeViewEditorProps } from './editor/treeViewEditor';

export function doSelect(settings: TreeViewEditorProps | undefined, element: ElementState | FrameState) {
  if (settings?.scene) {
    try {
      let selection: SelectionParams = { targets: [] };
      if (element instanceof FrameState) {
        const targetElements: HTMLDivElement[] = [];
        targetElements.push(element?.div!);
        selection.targets = targetElements;
        selection.frame = element;
        settings.scene.select(selection);
      } else if (element instanceof ElementState) {
        settings.scene.currentLayer = element.parent;
        selection.targets = [element?.div!];
        settings.scene.select(selection);
      }
    } catch (error) {
      appEvents.emit(AppEvents.alertError, ['Unable to select element, try selecting element in panel instead']);
    }
  }
}
