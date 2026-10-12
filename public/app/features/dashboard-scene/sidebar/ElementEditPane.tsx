import { useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase } from '@grafana/scenes';

import { DashboardLoadingBar } from '../scene/DashboardLoadingBar';

import { type ElementEditPaneRenderer } from './ElementEditPaneRenderer';

type Renderer = typeof ElementEditPaneRenderer;

let loadedRenderer: Renderer | undefined;

function LazyElementEditPaneRenderer(props: SceneComponentProps<ElementEditPane>) {
  const [Renderer, setRenderer] = useState(() => loadedRenderer);
  const [loadError, setLoadError] = useState<{ error: unknown }>();

  useEffect(() => {
    if (loadedRenderer) {
      setRenderer(() => loadedRenderer);
      return;
    }

    let cancelled = false;

    // Keep the options forms lazy without Suspense, which triggers a drag-and-drop
    // class lifecycle failure when opening Options in recorded session replays.
    import(/* webpackChunkName: "dashboard-edit-actions" */ './ElementEditPaneRenderer').then(
      (module) => {
        loadedRenderer = module.ElementEditPaneRenderer;
        if (!cancelled) {
          setRenderer(() => module.ElementEditPaneRenderer);
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          setLoadError({ error });
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  if (loadError) {
    throw loadError.error;
  }

  return Renderer ? (
    <Renderer {...props} />
  ) : (
    <DashboardLoadingBar label={t('dashboard.loading.sidebar', 'Loading sidebar')} />
  );
}

export class ElementEditPane extends SceneObjectBase {
  public static Component = LazyElementEditPaneRenderer;
  protected static _renderBeforeActivation = true;

  public getId() {
    return 'element' as const;
  }
}
