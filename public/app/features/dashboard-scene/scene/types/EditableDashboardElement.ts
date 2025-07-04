import { ReactNode } from 'react';

import { IconName } from '@grafana/data';
import { SceneObject } from '@grafana/scenes';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

/**
 * Interface for elements that have options
 */
export interface EditableDashboardElement {
  /**
   * Marks this object as an element that can be selected and edited directly on the canvas
   */
  isEditableDashboardElement: true;

  /** A descriptor used by editing pane */
  getEditableElementInfo(): EditableDashboardElementInfo;

  /**
   * Hook that returns edit pane options
   */
  useEditPaneOptions(isNewElement: boolean): OptionsPaneCategoryDescriptor[];

  /**
   * Panel Actions
   **/
  renderActions?(): ReactNode;

  /**
   * Supports delete action
   */
  onDelete?(): void;

  /**
   * Should confirm delete action
   */
  onConfirmDelete?(): void;

  /**
   * Supports duplicate action
   */
  onDuplicate?(): void;

  /**
   * Supports copy action
   */
  onCopy?(): void;

  /**
   * creates a new multi-selection element from a list of selected items
   */
  createMultiSelectedElement?(elements: this[]): EditableDashboardElement;

  /**
   * scroll element into view (when selected from outline)
   */
  scrollIntoView?(): void;

  /**
   * Used to sync row collapsed state with outline
   */
  getCollapsedState?(): boolean;

  /**
   * Used to sync row collapsed state with outline
   */
  setCollapsedState?(collapsed: boolean): void;

  /**
   * Used to change name from outline
   */
  onChangeName?(name: string): { errorMessage?: string } | void;

  /**
   * Container objects can have children
   */
  getOutlineChildren?(): SceneObject[];
}

export interface EditableDashboardElementInfo {
  instanceName: string;
  typeName: string;
  icon: IconName;
  isHidden?: boolean;
}

export function isEditableDashboardElement(obj: object): obj is EditableDashboardElement {
  return 'isEditableDashboardElement' in obj;
}
