import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState, VizPanel } from '@grafana/scenes';

import { ModalSceneObjectLike } from '../sharing/types';
import { getDashboardSceneFor } from '../utils/utils';

import { UnlinkModal } from './UnlinkModal';

interface UnlinkLibraryPanelModalState extends SceneObjectState {
  panelRef?: SceneObjectRef<VizPanel>;
}

export class UnlinkLibraryPanelModal
  extends SceneObjectBase<UnlinkLibraryPanelModalState>
  implements ModalSceneObjectLike
{
  static Component = UnlinkLibraryPanelModalRenderer;

  public onDismiss = () => {
    const dashboard = getDashboardSceneFor(this);
    dashboard.closeModal();
  };

  public onConfirm = () => {
    const dashboard = getDashboardSceneFor(this);
    dashboard.unlinkLibraryPanel(this.state.panelRef!.resolve());
    dashboard.closeModal();
  };
}

function UnlinkLibraryPanelModalRenderer({ model }: SceneComponentProps<UnlinkLibraryPanelModal>) {
  return (
    <UnlinkModal
      isOpen={true}
      onConfirm={() => {
        model.onConfirm();
        model.onDismiss();
      }}
      onDismiss={model.onDismiss}
    />
  );
}
