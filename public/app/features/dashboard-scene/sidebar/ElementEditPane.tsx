import { lazy, Suspense } from 'react';

import { type SceneComponentProps, SceneObjectBase } from '@grafana/scenes';

// The renderer pulls in getEditableElementFor and every editable element class
// (plus their options forms), so it is loaded on demand when the pane first renders.
const ElementEditPaneRenderer = lazy(() =>
  import(/* webpackChunkName: "dashboard-edit-actions" */ './ElementEditPaneRenderer').then((m) => ({
    default: m.ElementEditPaneRenderer,
  }))
);

function LazyElementEditPaneRenderer(props: SceneComponentProps<ElementEditPane>) {
  return (
    <Suspense fallback={null}>
      <ElementEditPaneRenderer {...props} />
    </Suspense>
  );
}

export class ElementEditPane extends SceneObjectBase {
  public static Component = LazyElementEditPaneRenderer;
  protected static _renderBeforeActivation = true;

  public getId() {
    return 'element' as const;
  }
}
