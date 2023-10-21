import { SceneFlexItem } from '@grafana/scenes';

import { getTrailFor } from './utils';

export function showOnlyInAdvanced(obj: SceneFlexItem) {
  const trail = getTrailFor(obj);
  const sub = trail.subscribeToState((state, prev) => {
    if (state.advancedMode !== !obj.state.isHidden) {
      obj.setState({ isHidden: !state.advancedMode });
    }
  });

  if (trail.state.advancedMode !== !obj.state.isHidden) {
    obj.setState({ isHidden: !trail.state.advancedMode });
  }

  return () => sub.unsubscribe();
}
