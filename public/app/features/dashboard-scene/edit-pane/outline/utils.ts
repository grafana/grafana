import { fuzzySearch } from '@grafana/data';
import { type SceneObject } from '@grafana/scenes';

import { getEditableElementFor } from '../shared';

export function getVisibleOutlineChildren(sceneObject: SceneObject, isEditing: boolean): SceneObject[] {
  const editableElement = getEditableElementFor(sceneObject);
  if (!editableElement?.getOutlineChildren) {
    return [];
  }

  const outlineChildren = editableElement.getOutlineChildren(isEditing) ?? [];
  if (isEditing) {
    return outlineChildren;
  }

  return outlineChildren.filter((child) => !getEditableElementFor(child)?.getEditableElementInfo().isHidden);
}

export interface SearchMatchResult {
  matchingKeys: Set<string>;
  visibleKeys: Set<string>;
}

export function computeSearchMatches(
  root: SceneObject,
  searchQuery: string,
  isEditing: boolean,
  noTitleText: string
): SearchMatchResult {
  const nodeKeys: string[] = [];
  const haystack: string[] = [];

  function collectNodes(node: SceneObject, depth: number) {
    const editableElement = getEditableElementFor(node);
    if (!editableElement) {
      return;
    }

    const elementInfo = editableElement.getEditableElementInfo();
    if (elementInfo.isHidden && !isEditing) {
      return;
    }

    const key = node.state.key;
    if (depth > 0 && key) {
      const instanceName = elementInfo.instanceName || noTitleText;
      const description =
        'description' in node.state && typeof node.state.description === 'string' ? node.state.description : '';
      nodeKeys.push(key);
      haystack.push(`${instanceName} ${elementInfo.typeName} ${description}`);
    }

    for (const child of getVisibleOutlineChildren(node, isEditing)) {
      collectNodes(child, depth + 1);
    }
  }

  collectNodes(root, 0);

  const matchingKeys = new Set<string>();
  for (const idx of fuzzySearch(haystack, searchQuery)) {
    matchingKeys.add(nodeKeys[idx]);
  }

  const visibleKeys = new Set<string>();

  function computeAncestry(node: SceneObject): boolean {
    const editableElement = getEditableElementFor(node);
    if (!editableElement) {
      return false;
    }

    const elementInfo = editableElement.getEditableElementInfo();
    if (elementInfo.isHidden && !isEditing) {
      return false;
    }

    const key = node.state.key;
    const isMatch = key !== undefined && matchingKeys.has(key);

    let hasMatchingDescendant = false;
    for (const child of getVisibleOutlineChildren(node, isEditing)) {
      if (computeAncestry(child)) {
        hasMatchingDescendant = true;
      }
    }

    if ((isMatch || hasMatchingDescendant) && key) {
      visibleKeys.add(key);
      return true;
    }

    return false;
  }

  computeAncestry(root);
  return { matchingKeys, visibleKeys };
}
