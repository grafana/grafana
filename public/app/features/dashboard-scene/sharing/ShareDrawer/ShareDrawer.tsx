import { locationService } from '@grafana/runtime';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  VizPanel,
  sceneGraph,
} from '@grafana/scenes';
import { Drawer } from '@grafana/ui';

import { shareDashboardType } from '../../../dashboard/components/ShareModal/utils';
import { ShareDownloadTab } from '../../bmc/Download/ShareDownloadTab';
import { DashboardScene } from '../../scene/DashboardScene';
import { getDashboardSceneFor } from '../../utils/utils';
import { ExportAsJson } from '../ExportButton/ExportAsJson';
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
    if (this.state.panelRef) {
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
  const { activeShare, panelRef } = model.useState();
  const dashboard = getDashboardSceneFor(model);
  // BMC Change: Adding dashboard/panel name along with download title
  let drawerTitle = activeShare?.getTabLabel();

  if (drawerTitle?.toLowerCase() === 'download') {
    if (panelRef) {
      const panel = panelRef.resolve();
      if (panel) {
        drawerTitle = sceneGraph.interpolate(panel, `Download: ${panel.state.title}`);
      }
    }

    if (!panelRef || !drawerTitle) {
      const dashboardTitle = dashboard?.state?.title ?? 'Dashboard';
      drawerTitle = `Download: ${dashboardTitle}`;
    }
  }
  // BMC Change: Ends

  return (
    <Drawer title={drawerTitle} onClose={model.onDismiss} size="md">
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
      return new ExportAsJson({ onDismiss });
    //BMC Change: Starts
    case shareDashboardType.download:
      return new ShareDownloadTab({ dashboardRef, panelRef, onDismiss });
    //BMC Change: Ends
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
    //BMC Change: Starts
    case shareDashboardType.download:
      return new ShareDownloadTab({ dashboardRef, panelRef, onDismiss });
    //BMC Change: Ends
    default:
      return new SharePanelInternally({ panelRef, onDismiss });
  }
}
