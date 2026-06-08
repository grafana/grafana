import { type SceneComponentProps } from '@grafana/scenes';

import { UnlinkModal } from '../scene/UnlinkModal';
import { getLibraryPanelBehavior } from '../utils/utils';

import { type PanelEditor } from './PanelEditor';
import { SaveLibraryVizPanelModal } from './SaveLibraryVizPanelModal';

// Both panel editor renderers (v1 and PanelEditNext) open these modals by toggling state on the
// PanelEditor, so they render here to avoid code duplication.
export function LibraryPanelEditModals({ model }: SceneComponentProps<PanelEditor>) {
  const { showLibraryPanelSaveModal, showLibraryPanelUnlinkModal } = model.useState();
  const panel = model.getPanel();
  const libraryPanel = getLibraryPanelBehavior(panel);

  if (!libraryPanel) {
    return null;
  }

  return (
    <>
      {showLibraryPanelSaveModal && (
        <SaveLibraryVizPanelModal
          libraryPanel={libraryPanel}
          onDismiss={model.onDismissLibraryPanelSaveModal}
          onConfirm={model.onConfirmSaveLibraryPanel}
          onDiscard={model.onDiscard}
        />
      )}
      {showLibraryPanelUnlinkModal && (
        <UnlinkModal
          onDismiss={model.onDismissUnlinkLibraryPanelModal}
          onConfirm={model.onConfirmUnlinkLibraryPanel}
          isOpen
        />
      )}
    </>
  );
}
