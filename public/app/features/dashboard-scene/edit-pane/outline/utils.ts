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

export function computeSearchMatches(
  sceneObject: SceneObject,
  searchQuery: string,
  isEditing: boolean,
  noTitleText: string
): {
  matchingKeys: Set<string>;
  visibleKeys: Set<string>;
} {
  const matchingKeys = new Set<string>();
  const visibleKeys = new Set<string>();

  function walk(node: SceneObject, depth: number): boolean {
    const editableElement = getEditableElementFor(node);
    if (!editableElement) {
      return false;
    }

    const elementInfo = editableElement.getEditableElementInfo();
    if (elementInfo.isHidden && !isEditing) {
      return false;
    }

    const key = node.state.key;
    const instanceName = elementInfo.instanceName === '' ? noTitleText : elementInfo.instanceName;

    const description =
      'description' in node.state && typeof node.state.description === 'string' ? node.state.description : '';
    const searchableText = `${instanceName} ${elementInfo.typeName} ${description}`.toLowerCase();

    const isDirectMatch = depth > 0 && searchableText.includes(searchQuery);

    const children = getVisibleOutlineChildren(node, isEditing);
    let hasMatchingDescendant = false;
    for (const child of children) {
      if (walk(child, depth + 1)) {
        hasMatchingDescendant = true;
      }
    }

    if (isDirectMatch && key) {
      matchingKeys.add(key);
    }

    if ((isDirectMatch || hasMatchingDescendant) && key) {
      visibleKeys.add(key);
      return true;
    }

    return false;
  }

  walk(sceneObject, 0);
  return { matchingKeys, visibleKeys };
}
