import { lazy, Suspense } from 'react';

import { t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Spinner } from '@grafana/ui';

import { type SceneShareTabState, type ShareView } from '../types';

const ExportAsImageRenderer = lazy(() =>
  import('../ShareRenderers').then((m) => ({ default: m.ExportAsImageRenderer }))
);

function LazyExportAsImageRenderer(props: SceneComponentProps<ExportAsImage>) {
  return (
    <Suspense fallback={<Spinner />}>
      <ExportAsImageRenderer {...props} />
    </Suspense>
  );
}

export class ExportAsImage extends SceneObjectBase<SceneShareTabState> implements ShareView {
  static Component = LazyExportAsImageRenderer;

  public getTabLabel() {
    return t('share-modal.image.title', 'Export as image');
  }
}
