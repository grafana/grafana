import { lazy, Suspense } from 'react';

import { t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase, type SceneObjectRef, type VizPanel } from '@grafana/scenes';
import { Spinner } from '@grafana/ui';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';

import { type SceneShareTabState } from './types';

const ShareLibraryPanelTabRenderer = lazy(() =>
  import('./ShareRenderers').then((m) => ({ default: m.ShareLibraryPanelTabRenderer }))
);

function LazyShareLibraryPanelTabRenderer(props: SceneComponentProps<ShareLibraryPanelTab>) {
  return (
    <Suspense fallback={<Spinner />}>
      <ShareLibraryPanelTabRenderer {...props} />
    </Suspense>
  );
}

export interface ShareLibraryPanelTabState extends SceneShareTabState {
  panelRef?: SceneObjectRef<VizPanel>;
}

export class ShareLibraryPanelTab extends SceneObjectBase<ShareLibraryPanelTabState> {
  public tabId = shareDashboardType.libraryPanel;
  static Component = LazyShareLibraryPanelTabRenderer;

  public getTabLabel() {
    return t('share-panel.drawer.new-library-panel-title', 'New library panel');
  }
}
