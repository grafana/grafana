import { PublicDashboardModel, PublicDashboardSrv } from './types';

export class PublicDashboardModelWrapper implements PublicDashboardModel {
  #dashboard: PublicDashboardModel | undefined;
  setCurrentDashboard(dashboard: PublicDashboardModel) {
    this.#dashboard = dashboard;
  }

  get uid() {
    return this.#dashboard?.uid ?? '';
  }

  get title() {
    return this.#dashboard?.title ?? '';
  }

  get panels() {
    //TODO WRAP THIS
    return this.#dashboard?.panels ?? [];
  }
}

export class PublicDashboardSrvSingleton implements PublicDashboardSrv {
  // This is the original internal grafana-core dashboard service singleton
  // we don't want to expose this to the public API
  #internalSingletonInstance: PublicDashboardSrv;
  #dashboardWrapper: PublicDashboardModelWrapper;

  constructor(instance: Partial<PublicDashboardSrv>) {
    this.#internalSingletonInstance = instance;
    this.#dashboardWrapper = new PublicDashboardModelWrapper();
  }

  get dashboard(): PublicDashboardModel | undefined {
    if (!this.#internalSingletonInstance.dashboard) {
      return undefined;
    }
    this.#dashboardWrapper.setCurrentDashboard(this.#internalSingletonInstance.dashboard);
    return this.#dashboardWrapper;
  }
}
