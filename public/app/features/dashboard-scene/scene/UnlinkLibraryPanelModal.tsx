import {
  type SceneComponentProps,
  SceneObjectBase,
  type SceneObjectRef,
  type SceneObjectState,
  type VizPanel,
} from '@grafana/scenes';
import { getDashboardSceneFor } from 'app/features/dashboard-scene/utils/getDashboardSceneFor';

import { type ModalSceneObjectLike } from '../sharing/types';

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
