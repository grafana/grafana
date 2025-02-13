import { DashboardLayoutManager, TransitionManager } from '../types/DashboardLayoutManager';

import { RowsLayoutManager } from './RowsLayoutManager';

export class RowsLayoutTransitionManager implements TransitionManager {
  public transitionFrom(layout: DashboardLayoutManager): RowsLayoutManager {
    return RowsLayoutManager.createEmpty();
  }
}
