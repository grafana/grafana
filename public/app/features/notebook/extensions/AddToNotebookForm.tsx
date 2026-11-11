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

interface CommonProps {
  onClose: () => void;
  /** Prefills the new-notebook title. */
  defaultTitle?: string;
  /** Called once the content is written. `url` is the notebook route, without the sub-path. */
  onAdded?: (notebook: AddedToNotebook & { url: string }) => void;
  /** Who added cells are attributed to. Defaults to `user`. */
  source?: AppendedCellSource;
}

interface SinglePanelProps extends CommonProps {
  /** Called on submit, not when the form opens. */
  buildPanel: () => Panel;
  /** The window the visualization was showing. The form offers to lock the panel to it. */
  capturedTimeRange: CapturedTimeRange;
  cells?: never;
}

interface CellsProps extends CommonProps {
  /** Ordered content to add instead of a single panel. Panels convert on submit. */
  cells: AddToNotebookFormCell[];
  buildPanel?: never;
  capturedTimeRange?: never;
}

export type Props = SinglePanelProps | CellsProps;

/** What a plugin can pass: nothing is type-checked across the plugin boundary. */
export type LooseProps = Partial<CommonProps> & {
  buildPanel?: () => Panel;
  capturedTimeRange?: CapturedTimeRange;
  cells?: AddToNotebookFormCell[];
};

/**
 * Internal implementation used by the exposed versioned wrapper.
 * For stability/versioning guidance, refer to AddToNotebookFormExposedComponent.
 */
export function AddToNotebookForm(props: Props): ReactElement {
  const { onClose, defaultTitle, onAdded, source } = props;
  const common = { onDismiss: onClose, entryPoint: NOTEBOOK_ENTRY_POINT.PLUGIN, defaultTitle, onAdded };

  if (props.cells) {
    const { cells } = props;
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

  const { buildPanel, capturedTimeRange } = props;
  return (
    <AddPanelToNotebookModalBody
      {...common}
      cellSource={source}
      buildPanel={async () => buildPanelElementFromPlugin(buildPanel())}
      isLibraryPanel={false}
      capturedTimeRange={capturedTimeRange}
    />
  );
}

export default AddToNotebookForm;
