import { DashboardLayoutManager, TransitionManager } from '../types/DashboardLayoutManager';

import { ResponsiveGridLayoutManager } from './ResponsiveGridLayoutManager';

export class ResponsiveGridLayoutTransitionManager implements TransitionManager {
  public transitionFrom(layout: DashboardLayoutManager): ResponsiveGridLayoutManager {
    return ResponsiveGridLayoutManager.createEmpty();
  }
}
