import { Stack } from '@grafana/ui';

import { EditableDashboardElement } from '../scene/types/EditableDashboardElement';

import { DashboardEditPane } from './DashboardEditPane';
import { EditPaneHeader } from './EditPaneHeader';

export interface Props {
  element: EditableDashboardElement;
  editPane: DashboardEditPane;
}

export function ElementEditPane({ element, editPane }: Props) {
  const categories = element.useEditPaneOptions ? element.useEditPaneOptions() : [];

  return (
    <Stack direction="column" gap={0}>
      <EditPaneHeader element={element} editPane={editPane} />
      {categories.map((cat) => cat.render())}
    </Stack>
  );
}
