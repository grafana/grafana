import { lazy, Suspense } from 'react';

import { t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Spinner } from '@grafana/ui';

import { type SceneShareTabState, type ShareView } from '../../types';

const ShareExternallyRenderer = lazy(() =>
  import('../../ShareRenderers').then((m) => ({ default: m.ShareExternallyRenderer }))
);

function LazyShareExternallyRenderer(props: SceneComponentProps<ShareExternally>) {
  return (
    <Suspense fallback={<Spinner />}>
      <ShareExternallyRenderer {...props} />
    </Suspense>
  );
}

export class ShareExternally extends SceneObjectBase<SceneShareTabState> implements ShareView {
  static Component = LazyShareExternallyRenderer;

  public getTabLabel() {
    return t('share-dashboard.menu.share-externally-title', 'Share externally');
  }
}
