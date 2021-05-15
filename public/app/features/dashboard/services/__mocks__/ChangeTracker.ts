import { DashboardModel } from '../../state/DashboardModel';

export class ChangeTracker {
  initCalled = false;

  init(dashboard: DashboardModel, originalCopyDelay: number) {
    this.initCalled = true;
  }
}
