import { type MouseEvent } from 'react';

import { type SceneObject } from '@grafana/scenes';

import { DashboardLinksSet } from '../../settings/links/DashboardLinksSet';
import { LinkEdit } from '../../settings/links/LinkAddEditableElement';
import { DashboardFiltersSet } from '../../settings/variables/DashboardFiltersSet';
import { SectionFiltersSet } from '../../settings/variables/SectionFiltersSet';
import { type DashboardEditPane } from '../DashboardEditPane';
import { getEditableElementFor } from '../shared';

export interface FlattenedOutlineNode {
  sceneObject: SceneObject;
  depth: number;
  index: number;
  path: string[];
  instanceName: string;
  typeName: string;
}

export function getOutlineInstanceName(instanceName: string, noTitleText: string): string {
  return instanceName === '' ? noTitleText : instanceName;
}

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

function isDisconnectedOutlineObject(sceneObject: SceneObject): boolean {
  return (
    sceneObject instanceof LinkEdit ||
    sceneObject instanceof DashboardLinksSet ||
    sceneObject instanceof DashboardFiltersSet ||
    sceneObject instanceof SectionFiltersSet
  );
}

export function selectOutlineObject(
  sceneObject: SceneObject,
  editPane: DashboardEditPane,
  isSelected: boolean,
  onSelect: ((e: MouseEvent) => void) | undefined,
  event: MouseEvent
): void {
  if (isSelected) {
    return;
  }

  if (isDisconnectedOutlineObject(sceneObject)) {
    // Select directly via editPane.selectObject because these objects are not
    // in the scene graph, so sceneGraph.findByKey (used by onSelect) can't find them.
    editPane.selectObject(sceneObject);
    return;
  }

  onSelect?.(event);
}

export function flattenOutlineNodes(
  sceneObject: SceneObject,
  isEditing: boolean,
  noTitleText: string
): FlattenedOutlineNode[] {
  const nodes: FlattenedOutlineNode[] = [];

  const walk = (node: SceneObject, depth: number, index: number, path: string[]) => {
    const editableElement = getEditableElementFor(node);
    if (!editableElement) {
      return;
    }

    const elementInfo = editableElement.getEditableElementInfo();
    if (elementInfo.isHidden && !isEditing) {
      return;
    }

    const instanceName = getOutlineInstanceName(elementInfo.instanceName, noTitleText);
    nodes.push({
      sceneObject: node,
      depth,
      index,
      path,
      instanceName,
      typeName: elementInfo.typeName,
    });

    getVisibleOutlineChildren(node, isEditing).forEach((child, childIndex) => {
      walk(child, depth + 1, childIndex, [...path, instanceName]);
    });
  };

  walk(sceneObject, 0, 0, []);
  return nodes;
}
