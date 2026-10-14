import { type ReactElement } from 'react';

import { type Panel } from '@grafana/schema';

import { AddPanelToNotebookModalBody } from '../addPanel/AddPanelToNotebookModalBody';
import { type AddedToNotebook } from '../addPanel/addPanelToNotebook';
import { type AppendedCellSource } from '../addPanel/appendPanelToNotebook';
import { type CapturedTimeRange } from '../addPanel/capturedTimeRange';
import { NOTEBOOK_ENTRY_POINT } from '../analytics/types';

import { buildPanelElementFromPlugin } from './buildPanelElementFromPlugin';

/** One cell of ordered content, e.g. an assistant answer with its panels. */
export type AddToNotebookFormCell =
  | { kind: 'markdown'; text: string }
  | {
      kind: 'panel';
      panel: Panel;
      /** The window this visualization was showing. The form offers to lock the panel to it. */
      capturedTimeRange: CapturedTimeRange;
    };

export interface Props {
  onClose: () => void;
  /**
   * Called on submit, not when the form opens. Pass this or `cells`, not both.
   */
  buildPanel?: () => Panel;
  /**
   * The window the visualization was showing. The form offers to lock the panel to it. Required with `buildPanel`.
   */
  capturedTimeRange?: CapturedTimeRange;
  /** Ordered content to add instead of a single panel. Panels convert on submit. */
  cells?: AddToNotebookFormCell[];
  /** Prefills the new-notebook title. */
  defaultTitle?: string;
  /** Called once the content is written. `url` is the notebook route, without the sub-path. */
  onAdded?: (notebook: AddedToNotebook & { url: string }) => void;
  /** Who added cells are attributed to. Defaults to `user`. */
  source?: AppendedCellSource;
}

/**
 * Internal implementation used by the exposed versioned wrapper.
 * For stability/versioning guidance, refer to AddToNotebookFormExposedComponent.
 */
export function AddToNotebookForm({
  onClose,
  buildPanel,
  capturedTimeRange,
  cells,
  defaultTitle,
  onAdded,
  source,
}: Props): ReactElement | null {
  const common = { onDismiss: onClose, entryPoint: NOTEBOOK_ENTRY_POINT.PLUGIN, defaultTitle, onAdded };

  if (cells) {
    return (
      <AddPanelToNotebookModalBody
        {...common}
        cellSource={source}
        cells={cells.map((cell) =>
          cell.kind === 'markdown'
            ? cell
            : {
                kind: 'panel',
                buildPanel: async () => buildPanelElementFromPlugin(cell.panel),
                capturedTimeRange: cell.capturedTimeRange,
              }
        )}
      />
    );
  }

  if (!buildPanel || !capturedTimeRange) {
    return null;
  }

  return (
    <AddPanelToNotebookModalBody
      {...common}
      buildPanel={async () => buildPanelElementFromPlugin(buildPanel())}
      isLibraryPanel={false}
      capturedTimeRange={capturedTimeRange}
    />
  );
}

export default AddToNotebookForm;
