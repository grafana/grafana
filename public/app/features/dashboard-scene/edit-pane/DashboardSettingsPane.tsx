import { DashboardScene } from '../scene/DashboardScene';

import { ElementEditPane } from './ElementEditPane';
import { useEditableElement } from './useEditableElement';

export function DashboardSettingsPane({ dashboard }: { dashboard: DashboardScene }) {
  const editableElement = useEditableElement(dashboard)!;
  return <ElementEditPane element={editableElement} key={editableElement.getTypeName()} />;
}
