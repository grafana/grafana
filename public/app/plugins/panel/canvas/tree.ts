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
}

export function reorderElements(src: FlatElement, dest: FlatElement, elements: any[]) {
  const result = Array.from(elements);

  const srcIndex = elements.indexOf(src);
  const destIndex = elements.indexOf(dest);

  const [removed] = result.splice(srcIndex, 1);
  result.splice(destIndex, 0, removed);

  return result;
}

export function getTreeData(root?: RootElement) {
  let elements: TreeElement[] = [];
  if (root) {
    root.elements.map((element: any) => {
      elements.push({
        key: element.UID,
        title: element.getName(),
        ...(element instanceof FrameState && { children: getChildren(element.elements) }),
        selectable: true,
        dataRef: element,
      });
    });
  }

  return elements;
}

function getChildren(elements: any[]) {
  let children: TreeElement[] = [];
  elements.map((element: any) => {
    children.push({
      key: element.UID,
      title: element.getName(),
      ...(element instanceof FrameState && { children: getChildren(element.elements) }),
      selectable: true,
      dataRef: element,
    });
  });

  return children;
}
