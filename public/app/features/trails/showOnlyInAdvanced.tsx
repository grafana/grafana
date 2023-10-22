import { SceneFlexItem } from '@grafana/scenes';

import { getTrailFor } from './utils';

export function showOnlyInAdvanced(obj: SceneFlexItem) {
  const settings = getTrailFor(obj).state.settings;
  const sub = settings.subscribeToState((state, prev) => {
    if (Boolean(state.showQuery) !== !Boolean(obj.state.isHidden)) {
      obj.setState({ isHidden: !Boolean(state.showQuery) });
    }
  });

  if (Boolean(settings.state.showQuery) !== !Boolean(obj.state.isHidden)) {
    obj.setState({ isHidden: !Boolean(settings.state.showQuery) });
  }

  return () => sub.unsubscribe();
}
