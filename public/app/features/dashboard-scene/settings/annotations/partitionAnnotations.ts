import { type SceneDataLayerProvider } from '@grafana/scenes';

import { DashboardAnnotationsDataLayer } from '../../scene/DashboardAnnotationsDataLayer';
import { partitionSceneObjects } from '../../sidebar/dashboard/helpers';

/**
 * Sections have no controls menu (hasControlsMenu: false), so layers placed there are listed as visible,
 * matching how the section controls render them.
 */
export function partitionAnnotationsByDisplay(
  annotationLayers: SceneDataLayerProvider[],
  { hasControlsMenu = true }: { hasControlsMenu?: boolean } = {}
) {
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
      if (hasControlsMenu && a.state.placement === 'inControlsMenu') {
        return 'controlsMenu';
      }
      return 'visible';
    }
  );
  return { visible, controlsMenu, hidden };
}
