import { type SceneDataLayerProvider } from '@grafana/scenes';

import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';

export function partitionAnnotationsByDisplay(annotationLayers: SceneDataLayerProvider[]) {
  const visible: DashboardAnnotationsDataLayer[] = [];
  const controlsMenu: DashboardAnnotationsDataLayer[] = [];
  const hidden: DashboardAnnotationsDataLayer[] = [];

  for (const annotation of annotationLayers) {
    if (!(annotation instanceof DashboardAnnotationsDataLayer)) {
      continue;
    }

    if (annotation.state.isHidden) {
      hidden.push(annotation);
    } else if (annotation.state.placement === 'inControlsMenu') {
      controlsMenu.push(annotation);
    } else {
      visible.push(annotation);
    }
  }

  return { visible, controlsMenu, hidden };
}
