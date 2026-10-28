import { type SceneDataLayerProvider } from '@grafana/scenes';

import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { partitionSceneObjects } from '../../sidebar/dashboard/helpers';

export function partitionAnnotationsByDisplay(annotationLayers: SceneDataLayerProvider[]) {
  const {
    visible = [],
    controlsMenu = [],
    hidden = [],
  } = partitionSceneObjects(
    annotationLayers.filter((a) => a instanceof DashboardAnnotationsDataLayer),
    (a) => {
      if (a.state.isHidden) {
        return 'hidden';
      }
      if (a.state.placement === 'inControlsMenu') {
        return 'controlsMenu';
      }
      return 'visible';
    }
  );
  return { visible, controlsMenu, hidden };
}
