import { Stack } from '@grafana/ui';

import { EditableDashboardElement } from '../scene/types/EditableDashboardElement';

import { EditPaneHeader } from './EditPaneHeader';

export interface Props {
  element: EditableDashboardElement;
}

export function ElementEditPane({ element }: Props) {
  const categories = element.useEditPaneOptions ? element.useEditPaneOptions() : [];

  return (
    <Stack direction="column" gap={0}>
      <EditPaneHeader element={element} />
      {categories.map((cat) => cat.render())}
    </Stack>
  );
}
