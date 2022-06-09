import { ElementState } from '../../../features/canvas/runtime/element';
import { FrameState } from '../../../features/canvas/runtime/frame';
import { RootElement } from '../../../features/canvas/runtime/root';

export interface FlatElement {
  node: ElementState;
  depth: number;
  isOpen?: boolean;
}

function flattenElements(node: FrameState, array: FlatElement[], depth: number) {
  for (let i = node.elements.length; i--; i >= 0) {
    const child = node.elements[i];
    const nodeDetails = { node: child, depth: depth + 1, ...(child instanceof FrameState && { isOpen: true }) };
    array.push(nodeDetails);

    if (child instanceof FrameState) {
      flattenElements(child, array, depth + 1);
    }
  }
}

export function getFlatElements(root?: RootElement) {
  const flat: FlatElement[] = [];
  if (root) {
    flattenElements(root, flat, 0);
  }

  return flat;
}

export function reorderElements(src: FlatElement, dest: FlatElement, elements: any[]) {
  const result = Array.from(elements);

  const srcIndex = elements.indexOf(src);
  const destIndex = elements.indexOf(dest);

  const [removed] = result.splice(srcIndex, 1);
  result.splice(destIndex, 0, removed);

  return result;
}

export function collapseParent(node: FlatElement) {
  node.isOpen = !node.isOpen;
}

export function getParent(node: FlatElement, nodes: FlatElement[]) {
  return nodes.filter(function (el) {
    return el.node.UID === node.node.parent?.UID;
  })[0];
}
