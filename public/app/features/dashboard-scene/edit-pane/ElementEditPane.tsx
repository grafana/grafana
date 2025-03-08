import { Stack } from '@grafana/ui';

import { EditableDashboardElement } from '../scene/types/EditableDashboardElement';
import { MultiSelectedEditableDashboardElement } from '../scene/types/MultiSelectedEditableDashboardElement';

import { EditPaneHeader } from './EditPaneHeader';

export interface Props {
  element: EditableDashboardElement | MultiSelectedEditableDashboardElement;
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
