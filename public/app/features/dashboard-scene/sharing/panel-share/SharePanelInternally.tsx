import { lazy, Suspense } from 'react';

import { t } from '@grafana/i18n';
import { type SceneComponentProps } from '@grafana/scenes';
import { Spinner } from '@grafana/ui';

import { ShareLinkTab } from '../ShareLinkTab';

const SharePanelInternallyRenderer = lazy(() =>
  import('../ShareRenderers').then((m) => ({ default: m.SharePanelInternallyRenderer }))
);

function LazySharePanelInternallyRenderer(props: SceneComponentProps<SharePanelInternally>) {
  return (
    <Suspense fallback={<Spinner />}>
      <SharePanelInternallyRenderer {...props} />
    </Suspense>
  );
}

export class SharePanelInternally extends ShareLinkTab {
  static Component = LazySharePanelInternallyRenderer;

  public getTabLabel() {
    return t('share-panel.drawer.share-link-title', 'Link settings');
  }
}
