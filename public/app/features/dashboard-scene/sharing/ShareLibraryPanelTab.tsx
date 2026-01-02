import { t } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase, SceneObjectRef, VizPanel } from '@grafana/scenes';
import { LibraryPanel } from '@grafana/schema';
import { ShareLibraryPanel } from 'app/features/dashboard/components/ShareModal/ShareLibraryPanel';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';

import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import {
  gridItemToPanel,
  transformSceneToSaveModel,
  vizPanelToPanel,
} from '../serialization/transformSceneToSaveModel';
import { getDashboardSceneFor } from '../utils/utils';

import { SceneShareTabState } from './types';

export interface ShareLibraryPanelTabState extends SceneShareTabState {
  panelRef?: SceneObjectRef<VizPanel>;
}

export class ShareLibraryPanelTab extends SceneObjectBase<ShareLibraryPanelTabState> {
  public tabId = shareDashboardType.libraryPanel;
  static Component = ShareLibraryPanelTabRenderer;

  public getTabLabel() {
    return t('share-panel.drawer.new-library-panel-title', 'New library panel');
  }
}

function ShareLibraryPanelTabRenderer({ model }: SceneComponentProps<ShareLibraryPanelTab>) {
  const { panelRef, modalRef } = model.useState();

  if (!panelRef) {
    return null;
  }

  const panel = panelRef.resolve();
  const parent = panel.parent;

  if (parent instanceof DashboardGridItem || parent instanceof AutoGridItem) {
    const dashboardScene = getDashboardSceneFor(model);
    const panelJson =
      parent instanceof DashboardGridItem ? gridItemToPanel(parent) : autoGridItemToLibraryPanel(parent);
    const panelModel = new PanelModel(panelJson);

    const dashboardJson = transformSceneToSaveModel(dashboardScene);
    const dashboardModel = new DashboardModel(dashboardJson);

    return (
      <ShareLibraryPanel
        initialFolderUid={dashboardScene.state.meta.folderUid}
        dashboard={dashboardModel}
        panel={panelModel}
        onDismiss={() => {
          modalRef ? modalRef.resolve().onDismiss() : dashboardScene.closeModal();
        }}
        onCreateLibraryPanel={(libPanel: LibraryPanel) => dashboardScene.createLibraryPanel(panel, libPanel)}
      />
    );
  }

  return null;
}

function autoGridItemToLibraryPanel(autoGridItem: AutoGridItem) {
  const vizPanel = autoGridItem.state.body;
  if (!(vizPanel instanceof VizPanel)) {
    throw new Error('AutoGridItem body expected to be VizPanel');
  }

  return vizPanelToPanel(vizPanel, { x: 0, y: 0, w: 6, h: 3 }, false, autoGridItem);
}
