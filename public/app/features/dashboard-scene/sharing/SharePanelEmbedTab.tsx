import { lazy, Suspense } from 'react';

import { t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase, type SceneObjectRef, type VizPanel } from '@grafana/scenes';
import { Spinner } from '@grafana/ui';
import { shareDashboardType } from 'app/features/dashboard/components/ShareModal/utils';

import { type SceneShareTabState } from './types';

const SharePanelEmbedTabRenderer = lazy(() =>
  import('./ShareRenderers').then((m) => ({ default: m.SharePanelEmbedTabRenderer }))
);

function LazySharePanelEmbedTabRenderer(props: SceneComponentProps<SharePanelEmbedTab>) {
  return (
    <Suspense fallback={<Spinner />}>
      <SharePanelEmbedTabRenderer {...props} />
    </Suspense>
  );
}

export interface SharePanelEmbedTabState extends SceneShareTabState {
  panelRef: SceneObjectRef<VizPanel>;
}

export class SharePanelEmbedTab extends SceneObjectBase<SharePanelEmbedTabState> {
  public tabId = shareDashboardType.embed;
  static Component = LazySharePanelEmbedTabRenderer;

  public constructor(state: SharePanelEmbedTabState) {
    super(state);
  }

  public getTabLabel() {
    return t('share-panel.drawer.share-embed-title', 'Share embed');
  }
}
