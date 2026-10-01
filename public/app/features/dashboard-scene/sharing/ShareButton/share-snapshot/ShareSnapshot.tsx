import { lazy, Suspense } from 'react';

import { t } from '@grafana/i18n';
import { type SceneComponentProps } from '@grafana/scenes';
import { Spinner } from '@grafana/ui';

import { ShareSnapshotTab } from '../../ShareSnapshotTab';
import { type ShareView } from '../../types';

const ShareSnapshotRenderer = lazy(() =>
  import('../../ShareRenderers').then((m) => ({ default: m.ShareSnapshotRenderer }))
);

function LazyShareSnapshotRenderer(props: SceneComponentProps<ShareSnapshot>) {
  return (
    <Suspense fallback={<Spinner />}>
      <ShareSnapshotRenderer {...props} />
    </Suspense>
  );
}

export class ShareSnapshot extends ShareSnapshotTab implements ShareView {
  static Component = LazyShareSnapshotRenderer;

  public getTabLabel() {
    return t('share-dashboard.menu.share-snapshot-title', 'Share snapshot');
  }
}
