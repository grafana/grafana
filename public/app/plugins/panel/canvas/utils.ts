import { AppEvents } from '@grafana/data/src';

import appEvents from '../../../core/app_events';
import { CanvasElementItem, canvasElementRegistry, defaultElementItems } from '../../../features/canvas';
import { ElementState } from '../../../features/canvas/runtime/element';
import { FrameState } from '../../../features/canvas/runtime/frame';
import { Scene, SelectionParams } from '../../../features/canvas/runtime/scene';

export function doSelect(scene: Scene, element: ElementState | FrameState) {
  try {
    let selection: SelectionParams = { targets: [] };
    if (element instanceof FrameState) {
      const targetElements: HTMLDivElement[] = [];
      targetElements.push(element?.div!);
      selection.targets = targetElements;
      selection.frame = element;
      scene.select(selection);
    } else {
      scene.currentLayer = element.parent;
      selection.targets = [element?.div!];
      scene.select(selection);
    }
  } catch (error) {
    appEvents.emit(AppEvents.alertError, ['Unable to select element, try selecting element in panel instead']);
  }
}

export function getElementTypes(
  shouldShowAdvancedTypes: boolean | undefined,
  current: string[] | undefined = undefined
) {
  return shouldShowAdvancedTypes
    ? canvasElementRegistry.selectOptions(current, (elementItem) => elementItem.id !== 'button').options
    : canvasElementRegistry.selectOptions(current, (elementItem: CanvasElementItem<any, any>) => {
        return !!defaultElementItems.filter((item) => item.id === elementItem.id).length;
      }).options;
}
