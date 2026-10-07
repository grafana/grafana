import { type VizPanel } from '@grafana/scenes';
import { Stack } from '@grafana/ui';
import { isLibraryPanel } from 'app/features/dashboard-scene/utils/utils';

import { type NotebookCellItem } from './NotebookCellItem';
import { OpenInExploreButton } from './OpenInExploreButton';
import { VizSuggestionsButton } from './VizSuggestionsButton';

/** The panel header's icon row. Explore is read-only, so it shows in view mode too. */
export function NotebookPanelHeaderActions({
  cell,
  panel,
  isEditing,
}: {
  cell: NotebookCellItem;
  panel: VizPanel;
  isEditing: boolean;
}) {
  const canChangeVisualization = isEditing && !isLibraryPanel(panel);

  return (
    <Stack direction="row" gap={0.5} alignItems="center">
      {canChangeVisualization && <VizSuggestionsButton cell={cell} panel={panel} />}
      <OpenInExploreButton panel={panel} />
    </Stack>
  );
}
