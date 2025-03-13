import { ReactNode } from 'react';

import { IconName } from '@grafana/data';
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
  useEditPaneOptions(): OptionsPaneCategoryDescriptor[];

  /**
   * Panel Actions
   **/
  renderActions?(): ReactNode;

  /**
   * Supports delete action
   */
  onDelete?(): void;

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
}

export interface EditableDashboardElementInfo {
  instanceName: string;
  typeName: string;
  icon: IconName;
}

export function isEditableDashboardElement(obj: object): obj is EditableDashboardElement {
  return 'isEditableDashboardElement' in obj;
}
