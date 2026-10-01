import { type ReactElement } from 'react';

import { type Panel } from '@grafana/schema';

import { AddPanelToNotebookModalBody } from '../addPanel/AddPanelToNotebookModalBody';
import { NOTEBOOK_ENTRY_POINT } from '../analytics/types';

import { buildPanelElementFromPlugin } from './buildPanelElementFromPlugin';

export interface Props {
  onClose: () => void;
  /**
   * Called on submit, not when the form opens.
   */
  buildPanel: () => Panel;
}

/**
 * Internal implementation used by the exposed versioned wrapper.
 * For stability/versioning guidance, refer to AddToNotebookFormExposedComponent.
 */
export function AddToNotebookForm({ onClose, buildPanel }: Props): ReactElement {
  return (
    <AddPanelToNotebookModalBody
      buildPanel={async () => buildPanelElementFromPlugin(buildPanel())}
      onDismiss={onClose}
      entryPoint={NOTEBOOK_ENTRY_POINT.PLUGIN}
      isLibraryPanel={false}
    />
  );
}

export default AddToNotebookForm;
