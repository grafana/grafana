import { SceneFlexItem } from '@grafana/scenes';

import { getTrailFor } from './getUtils';

export function onlyShowInDebugBehavior(obj: SceneFlexItem) {
  const trail = getTrailFor(obj);
  const sub = trail.subscribeToState((state, prev) => {
    if (state.debug !== !obj.state.isHidden) {
      obj.setState({ isHidden: !state.debug });
    }
  });

  if (trail.state.debug !== !obj.state.isHidden) {
    obj.setState({ isHidden: !trail.state.debug });
  }

  return () => sub.unsubscribe();
}
