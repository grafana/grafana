import { DeepPartial } from '@grafana/scenes';
import { DashboardLoaderSrv, setDashboardLoaderSrv } from 'app/features/dashboard/services/DashboardLoaderSrv';
import { DashboardDTO } from 'app/types';

export function setupLoadDashboardMock(rsp: DeepPartial<DashboardDTO>) {
  const loadDashboardMock = jest.fn().mockResolvedValue(rsp);
  setDashboardLoaderSrv({
    loadDashboard: loadDashboardMock,
  } as unknown as DashboardLoaderSrv);
  return loadDashboardMock;
}

export function mockResizeObserver() {
  (window as any).ResizeObserver = class ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      setTimeout(() => {
        callback(
          [
            {
              contentRect: {
                x: 1,
                y: 2,
                width: 500,
                height: 500,
                top: 100,
                bottom: 0,
                left: 100,
                right: 0,
              },
            } as ResizeObserverEntry,
          ],
          this
        );
      });
    }
    observe() {}
    disconnect() {}
    unobserve() {}
  };
}
