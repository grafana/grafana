import { EditableDashboardElement } from '../scene/types';

import { ElementEditPane } from './ElementEditPane';

export function SelectedObjectPane({ editableElement }: { editableElement: EditableDashboardElement }) {
  return <ElementEditPane element={editableElement} key={editableElement.getTypeName()} />;
}
