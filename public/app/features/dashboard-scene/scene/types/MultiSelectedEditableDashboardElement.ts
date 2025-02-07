import { ReactNode } from 'react';

import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

export interface MultiSelectedEditableDashboardElement {
  /**
   * Marks this object as an element that can be selected and edited directly on the canvas
   */
  isMultiSelectedEditableDashboardElement: true;

  /**
   * Type name of the element
   */
  typeName: Readonly<string>;

  /**
   * Extremely useful for being able to access the useState inside the contained items
   */
  key: Readonly<string>;

  /**
   * Hook that returns edit pane options
   */
  useEditPaneOptions?(): OptionsPaneCategoryDescriptor[];

  /**
   * Panel Actions
   **/
  renderActions?(): ReactNode;
}

export function isMultiSelectedEditableDashboardElement(obj: object): obj is MultiSelectedEditableDashboardElement {
  return 'isMultiSelectedEditableDashboardElement' in obj;
}
