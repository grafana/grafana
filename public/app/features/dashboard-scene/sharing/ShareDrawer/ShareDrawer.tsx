import { locationService } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState, VizPanel } from '@grafana/scenes';
import { Drawer } from '@grafana/ui';

import { shareDashboardType } from '../../../dashboard/components/ShareModal/utils';
import { DashboardScene } from '../../scene/DashboardScene';
import { getDashboardSceneFor } from '../../utils/utils';
import { ExportAsCode } from '../ExportButton/ExportAsCode';
import { ExportAsImage } from '../ExportButton/ExportAsImage';
import { ShareExternally } from '../ShareButton/share-externally/ShareExternally';
import { ShareInternally } from '../ShareButton/share-internally/ShareInternally';
import { ShareSnapshot } from '../ShareButton/share-snapshot/ShareSnapshot';
import { ShareLibraryPanelTab } from '../ShareLibraryPanelTab';
import { SharePanelEmbedTab } from '../SharePanelEmbedTab';
import { SharePanelInternally } from '../panel-share/SharePanelInternally';
import { ModalSceneObjectLike, SceneShareTabState, ShareView } from '../types';

import { ShareDrawerContext } from './ShareDrawerContext';

export interface ShareDrawerState extends SceneObjectState {
  panelRef?: SceneObjectRef<VizPanel>;
  shareView: string;
  activeShare?: ShareView;
}

type CustomShareViewType = { id: string; shareOption: new (...args: SceneShareTabState[]) => ShareView };
const customShareViewOptions: CustomShareViewType[] = [];

export function addDashboardShareView(shareView: CustomShareViewType) {
  customShareViewOptions.push(shareView);
}

export class ShareDrawer extends SceneObjectBase<ShareDrawerState> implements ModalSceneObjectLike {
  static Component = ShareDrawerRenderer;

  constructor(state: Omit<ShareDrawerState, 'activeShare'>) {
    super({ ...state });
    this.addActivationHandler(() => this.buildActiveShare(state.shareView!));
  }

  onDismiss = () => {
    if (this.state.activeShare?.onDismiss) {
      this.state.activeShare.onDismiss();
    } else if (this.state.panelRef) {
      const dashboard = getDashboardSceneFor(this);
      dashboard.closeModal();
    } else {
      locationService.partial({ shareView: null });
    }
  };

  private buildActiveShare(shareView: string) {
    const { panelRef } = this.state;
    const dashboard = getDashboardSceneFor(this);

    const activeShare = panelRef
      ? getPanelShareView(shareView, this.onDismiss, dashboard.getRef(), panelRef)
      : getShareView(shareView, this.onDismiss, dashboard.getRef(), panelRef);

    this.setState({ activeShare });
  }
}

function ShareDrawerRenderer({ model }: SceneComponentProps<ShareDrawer>) {
  const { activeShare } = model.useState();
  const dashboard = getDashboardSceneFor(model);

  return (
    <Drawer title={activeShare?.getTabLabel()} onClose={model.onDismiss} size="md">
      <ShareDrawerContext.Provider value={{ dashboard, onDismiss: model.onDismiss }}>
        {activeShare && <activeShare.Component model={activeShare} />}
      </ShareDrawerContext.Provider>
    </Drawer>
  );
}

function getShareView(
  shareView: string,
  onDismiss: () => void,
  dashboardRef: SceneObjectRef<DashboardScene>,
  panelRef?: SceneObjectRef<VizPanel>
): ShareView {
  const currentShareView = customShareViewOptions.find((s) => s.id === shareView);
  if (currentShareView) {
    return new currentShareView.shareOption({ onDismiss });
  }

  switch (shareView) {
    case shareDashboardType.link:
      return new ShareInternally({ onDismiss });
    case shareDashboardType.publicDashboard:
      return new ShareExternally({ onDismiss });
    case shareDashboardType.snapshot:
      return new ShareSnapshot({ dashboardRef, panelRef, onDismiss });
    case shareDashboardType.export:
      return new ExportAsCode({ onDismiss });
    case shareDashboardType.image:
      return new ExportAsImage({ onDismiss });
    default:
      return new ShareInternally({ onDismiss });
  }
}

function getPanelShareView(
  shareView: string,
  onDismiss: () => void,
  dashboardRef: SceneObjectRef<DashboardScene>,
  panelRef: SceneObjectRef<VizPanel>
): ShareView {
  switch (shareView) {
    case shareDashboardType.link:
      return new SharePanelInternally({ panelRef, onDismiss });
    case shareDashboardType.snapshot:
      return new ShareSnapshot({ dashboardRef, panelRef, onDismiss });
    case shareDashboardType.embed:
      return new SharePanelEmbedTab({ panelRef, onDismiss });
    case shareDashboardType.libraryPanel:
      return new ShareLibraryPanelTab({ panelRef, onDismiss });
    default:
      return new SharePanelInternally({ panelRef, onDismiss });
  }
}
