import { type VizPanel } from '@grafana/scenes';
import { Stack } from '@grafana/ui';
import { isLibraryPanel } from 'app/features/dashboard-scene/utils/utils';

import { type NotebookCellItem } from './NotebookCellItem';
import { OpenInExploreButton } from './OpenInExploreButton';
import { VizSuggestionsButton } from './VizSuggestionsButton';

/**
 * The icon row rendered into a notebook panel's header (PanelChrome's `headerActions` slot - see
 * NotebookCellRenderer).
 *
 * Explore shows whether or not the notebook is being edited - it only reads the panel, it doesn't
 * change it. Changing the visualization is an edit, so it is edit-mode only, and never offered for a
 * library panel: that would change the shared panel everywhere it's used, not just in this notebook.
 */
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
