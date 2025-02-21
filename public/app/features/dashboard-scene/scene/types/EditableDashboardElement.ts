import { ReactNode } from 'react';

import { SceneObject } from '@grafana/scenes';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { MultiSelectedEditableDashboardElement } from './MultiSelectedEditableDashboardElement';

/**
 * Interface for elements that have options
 */
export interface EditableDashboardElement {
  /**
   * Marks this object as an element that can be selected and edited directly on the canvas
   */
  isEditableDashboardElement: true;

  /**
   * Type name of the element
   */
  typeName: Readonly<string>;

  /**
   * Hook that returns edit pane options
   */
  useEditPaneOptions(): OptionsPaneCategoryDescriptor[];

  /**
   * Panel Actions
   **/
  renderActions?(): ReactNode;

  /**
   * creates a new multi-selection element from a list of selected items
   */
  createMultiSelectedElement?(items: SceneObject[]): MultiSelectedEditableDashboardElement;
}

export function isEditableDashboardElement(obj: object): obj is EditableDashboardElement {
  return 'isEditableDashboardElement' in obj;
}
