import { locationService } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState, VizPanel } from '@grafana/scenes';
import { Drawer } from '@grafana/ui';

import { DashboardScene } from '../../scene/DashboardScene';
import { getDashboardSceneFor } from '../../utils/utils';
import { ShareExternally } from '../ShareButton/share-externally/ShareExternally';
import { ShareInternally } from '../ShareButton/share-internally/ShareInternally';
import { ShareSnapshot } from '../ShareButton/share-snapshot/ShareSnapshot';
import { ModalSceneObjectLike, ShareView } from '../types';

import { ShareDrawerContext } from './ShareDrawerContext';
import { ExportAsJson } from '../ExportButton/ExportAsJson';

export interface ShareDrawerState extends SceneObjectState {
  panelRef?: SceneObjectRef<VizPanel>;
  shareView: string;
}

export class ShareDrawer extends SceneObjectBase<ShareDrawerState> implements ModalSceneObjectLike {
  static Component = ShareDrawerRenderer;

  onDismiss = () => {
    locationService.partial({ shareView: null });
  };
}

function ShareDrawerRenderer({ model }: SceneComponentProps<ShareDrawer>) {
  const { shareView, panelRef } = model.useState();
  const dashboard = getDashboardSceneFor(model);

  const shareComponent = getShareView(shareView, dashboard.getRef(), panelRef);

  return (
    <Drawer title={shareComponent.getTabLabel()} onClose={model.onDismiss} size="md">
      <ShareDrawerContext.Provider value={{ dashboard }}>
        {<shareComponent.Component model={shareComponent} />}
      </ShareDrawerContext.Provider>
    </Drawer>
  );
}

function getShareView(
  shareView: string,
  dashboardRef: SceneObjectRef<DashboardScene>,
  panelRef?: SceneObjectRef<VizPanel>
): ShareView {
  switch (shareView) {
    case 'link':
      return new ShareInternally({ panelRef });
    case 'public_dashboard':
      return new ShareExternally({});
    case 'snapshot':
      return new ShareSnapshot({ dashboardRef, panelRef });
    case 'export':
      return new ExportAsJson({});
    default:
      return new ShareInternally({ panelRef });
  }
}
