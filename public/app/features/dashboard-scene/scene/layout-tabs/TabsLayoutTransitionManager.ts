import { DashboardLayoutManager, TransitionManager } from '../types/DashboardLayoutManager';

import { TabsLayoutManager } from './TabsLayoutManager';

export class TabsLayoutTransitionManager implements TransitionManager {
  public transitionFrom(layout: DashboardLayoutManager): TabsLayoutManager {
    return TabsLayoutManager.createEmpty();
  }
}
