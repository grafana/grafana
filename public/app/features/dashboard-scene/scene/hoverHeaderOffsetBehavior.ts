import { Unsubscribable } from 'rxjs';

import { VizPanel } from '@grafana/scenes';

import { DashboardGridItem } from './DashboardGridItem';
import { LibraryVizPanel } from './LibraryVizPanel';

export const hoverHeaderOffsetBehavior = (grid: DashboardGridItem) => {
  // this block handles hoverHeaderOffset on normal and loaded Library panels
  //    when navigating between dashboard and panel view/edit/add
  if (grid.state.body instanceof VizPanel || grid.state.body instanceof LibraryVizPanel) {
    const vizPanel = grid.state.body instanceof LibraryVizPanel ? grid.state.body.state.panel : grid.state.body;

    setHoverHeaderOffset(vizPanel, grid.state.y);
  }

  let onLibPanelLoadSub: Unsubscribable | undefined;

  // this block handles hoverHeaderOffset on Library panel load
  //    this is to avoid passing grid position to LibraryVizPanel state
  if (grid.state.body instanceof LibraryVizPanel && !grid.state.body.state.isLoaded) {
    onLibPanelLoadSub = grid.state.body.subscribeToState((newState, prevState) => {
      if (!prevState.isLoaded && newState.isLoaded) {
        setHoverHeaderOffset((grid.state.body as LibraryVizPanel).state.panel, grid.state.y);
      }
    });
  }

  // this block handles hoverHeaderOffset on normal and Library panels
  //    when moving panels around
  const sub = grid.subscribeToState((newState, prevState) => {
    if ([newState.y, prevState.y].includes(0) && newState.y !== prevState.y) {
      grid.forEachChild((child) => {
        if (child instanceof VizPanel || child instanceof LibraryVizPanel) {
          const vizPanel = child instanceof LibraryVizPanel ? child.state.panel : child;
          setHoverHeaderOffset(vizPanel, grid.state.y);
        }
      });
    }
  });

  return () => {
    sub.unsubscribe();
    if (onLibPanelLoadSub) {
      onLibPanelLoadSub.unsubscribe();
    }
  };
};

function setHoverHeaderOffset(vizPanel: VizPanel | undefined, yPos: number | undefined) {
  if (vizPanel?.state.hoverHeader) {
    const hoverHeaderOffset = yPos === 0 ? 0 : undefined;
    if (vizPanel.state.hoverHeaderOffset !== hoverHeaderOffset) {
      vizPanel.setState({ hoverHeaderOffset });
    }
  }
}
