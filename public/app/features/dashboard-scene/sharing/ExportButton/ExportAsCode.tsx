import { lazy, Suspense } from 'react';

import { t } from '@grafana/i18n';
import { type SceneComponentProps } from '@grafana/scenes';
import { Spinner } from '@grafana/ui';

import { ShareExportTab } from '../ShareExportTab';

const ExportAsCodeRenderer = lazy(() => import('../ShareRenderers').then((m) => ({ default: m.ExportAsCodeRenderer })));

function LazyExportAsCodeRenderer(props: SceneComponentProps<ExportAsCode>) {
  return (
    <Suspense fallback={<Spinner />}>
      <ExportAsCodeRenderer {...props} />
    </Suspense>
  );
}

export class ExportAsCode extends ShareExportTab {
  static Component = LazyExportAsCodeRenderer;

  public getTabLabel(): string {
    return t('export.json.title', 'Export dashboard');
  }

  public getSubtitle(): string | undefined {
    return t('export.json.info-text', 'Copy or download a file containing the definition of your dashboard');
  }
}
