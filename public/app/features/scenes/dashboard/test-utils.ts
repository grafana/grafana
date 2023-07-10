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

export class ResizeObserverMockHandler {
  private listeners: Set<ResizeObserverCallback> = new Set<ResizeObserverCallback>();

  constructor() {
    let outerSelf = this;

    (window as any).ResizeObserver = class ResizeObserver {
      callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        outerSelf.listeners.add(callback);
      }
      observe() {}
      disconnect() {
        outerSelf.listeners.delete(this.callback);
      }
    };
  }

  callResizeObserverListeners(width: number, height: number) {
    for (const listener of this.listeners.values()) {
      listener(
        [
          {
            contentRect: {
              x: 1,
              y: 2,
              width,
              height,
              top: 100,
              bottom: 0,
              left: 100,
              right: 0,
            },
          } as ResizeObserverEntry,
        ],
        undefined
      );
    }
  }
}
