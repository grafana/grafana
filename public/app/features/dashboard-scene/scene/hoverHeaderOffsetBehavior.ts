import { VizPanel } from '@grafana/scenes';

import { DashboardGridItem } from './DashboardGridItem';
import { LibraryVizPanel } from './LibraryVizPanel';

export const hoverHeaderOffsetBehavior = (grid: DashboardGridItem) => {
  const sub = grid.subscribeToState((newState, prevState) => {
    if ([newState.y, prevState.y].includes(0) && newState.y !== prevState.y) {
      grid.forEachChild((child) => {
        if (child instanceof VizPanel && child.state.hoverHeader) {
          child.setState({ hoverHeaderOffset: grid.state.y === 0 ? 0 : undefined });
        } else if (child instanceof LibraryVizPanel && child.state.panel?.state.hoverHeader) {
          child.state.panel.setState({ hoverHeaderOffset: grid.state.y === 0 ? 0 : undefined });
        }
      });
    }
  });
  return () => {
    sub.unsubscribe();
  };
};
