import { getRepeatSourceObject, forEachRepeatMirror } from '../utils/clone';

import { DashboardAnnotationsDataLayer } from './DashboardAnnotationsDataLayer';

/**
 * Enable or disable an annotation on the repeat source and every clone mirror.
 * Repeat clones are omitted on save and rebuilt from the source, so a toggle that only
 * touches a clone disappears. Updating the source persists the change; updating the
 * mirrors keeps the copies currently on screen in step until the next rebuild.
 */
export function setAnnotationLayerEnabled(layer: DashboardAnnotationsDataLayer, enabled: boolean) {
  const source = getRepeatSourceObject(layer);
  if (!(source instanceof DashboardAnnotationsDataLayer)) {
    return;
  }

  applyAnnotationEnabled(source, enabled);
  forEachRepeatMirror(source, (mirror) => {
    if (mirror instanceof DashboardAnnotationsDataLayer) {
      applyAnnotationEnabled(mirror, enabled);
    }
  });
}

function applyAnnotationEnabled(layer: DashboardAnnotationsDataLayer, enabled: boolean) {
  if (layer.state.isEnabled === enabled && layer.state.query.enable === enabled) {
    return;
  }

  layer.setState({
    isEnabled: enabled,
    query: {
      ...layer.state.query,
      enable: enabled,
    },
  });
}
