import { ElementState } from '../../../features/canvas/runtime/element';
import { FrameState } from '../../../features/canvas/runtime/frame';
import { RootElement } from '../../../features/canvas/runtime/root';

export interface FlatElement {
  node: ElementState;
  depth: number;
  isOpen?: boolean;
}

export interface TreeElement {
  key: number;
  title: string;
  selectable?: boolean;
  children?: TreeElement[];
  dataRef: ElementState | FrameState;
  style?: any;
}

export function reorderElements(src: FlatElement, dest: FlatElement, elements: any[]) {
  const result = Array.from(elements);

  const srcIndex = elements.indexOf(src);
  const destIndex = elements.indexOf(dest);

  const [removed] = result.splice(srcIndex, 1);
  result.splice(destIndex, 0, removed);

  return result;
}

export function getTreeData(root?: RootElement | FrameState, selection?: string[], color?: string) {
  let elements: TreeElement[] = [];
  if (root) {
    for (let i = root.elements.length; i--; i >= 0) {
      const item = root.elements[i];
      const element: TreeElement = {
        key: item.UID,
        title: item.getName(),
        selectable: true,
        dataRef: item,
      };

      const isSelected = isItemSelected(item, selection);
      if (isSelected) {
        element.style = { backgroundColor: color };
      }

      if (item instanceof FrameState) {
        element.children = getTreeData(item, selection, color);
      }
      elements.push(element);
    }
  }

  return elements;
}

function isItemSelected(item: ElementState, selection: string[] | undefined) {
  return Boolean(selection?.includes(item.getName()));
}
