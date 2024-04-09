import { VizPanel } from '@grafana/scenes';

import { DashboardGridItem } from './DashboardGridItem';

export const hoverHeaderOffsetBehavior = (grid: DashboardGridItem) => {
  const sub = grid.subscribeToState((newState, prevState) => {
    if ([newState.y, prevState.y].includes(0) && newState.y !== prevState.y) {
      grid.forEachChild((child) => {
        if (child instanceof VizPanel && child.state.hoverHeader) {
          child.setState({ hoverHeaderOffset: grid.state.y === 0 ? 0 : undefined });
        }
      });
    }

    return () => {
      sub.unsubscribe();
    };
  });
};
