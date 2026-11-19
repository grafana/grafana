import { type SceneComponentProps } from '@grafana/scenes';
import { SaveProvisionedLibraryPanelDrawer } from 'app/features/library-panels/components/SaveProvisionedLibraryPanelDrawer';
import { libraryVizPanelToSaveModel } from 'app/features/library-panels/state/api';

import { UnlinkModal } from '../scene/UnlinkModal';

import { type PanelEditor } from './PanelEditor';
import { SaveLibraryVizPanelModal } from './SaveLibraryVizPanelModal';

// Both panel editor renderers (v1 and PanelEditNext) open these modals by toggling state on the
// PanelEditor, so they render here to avoid code duplication.
export function LibraryPanelEditModals({ model }: SceneComponentProps<PanelEditor>) {
  const { showLibraryPanelSaveModal, showLibraryPanelSaveDrawer, showLibraryPanelUnlinkModal } = model.useState();
  const libraryPanel = model.getLibraryPanelBehavior();

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
      {showLibraryPanelSaveDrawer && (
        <SaveProvisionedLibraryPanelDrawer
          action="update"
          panel={libraryVizPanelToSaveModel(model.getPanel())}
          onDismiss={model.onDismissLibraryPanelSaveModal}
          onWriteSuccess={model.onLibraryPanelCommitted}
          onBranchSaved={() => model.onLibraryPanelSaved(false)}
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
