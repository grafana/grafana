import { type ReactElement } from 'react';

import { type Panel } from '@grafana/schema';

import { AddPanelToNotebookModalBody } from '../addPanel/AddPanelToNotebookModalBody';
import { type CapturedTimeRange } from '../addPanel/capturedTimeRange';
import { NOTEBOOK_ENTRY_POINT } from '../analytics/types';

import { buildPanelElementFromPlugin } from './buildPanelElementFromPlugin';

export interface Props {
  onClose: () => void;
  /**
   * Called on submit, not when the form opens.
   */
  buildPanel: () => Panel;
  /**
   * The window the visualization was showing. The form offers to lock the panel to it.
   */
  capturedTimeRange: CapturedTimeRange;
}

/**
 * Internal implementation used by the exposed versioned wrapper.
 * For stability/versioning guidance, refer to AddToNotebookFormExposedComponent.
 */
export function AddToNotebookForm({ onClose, buildPanel, capturedTimeRange }: Props): ReactElement {
  return (
    <AddPanelToNotebookModalBody
      buildPanel={async () => buildPanelElementFromPlugin(buildPanel())}
      onDismiss={onClose}
      entryPoint={NOTEBOOK_ENTRY_POINT.PLUGIN}
      isLibraryPanel={false}
      capturedTimeRange={capturedTimeRange}
    />
  );
}

export default AddToNotebookForm;
