import { BackendSrv, BackendSrvRequest } from '@grafana/runtime';

import { SandboxRuntime } from './runtime';

export class GrafanaRuntimeProxy {
  private sandboxRuntime: SandboxRuntime;
  constructor(sandboxRuntime: SandboxRuntime) {
    this.sandboxRuntime = sandboxRuntime;
  }

  getBackendSrv(): Partial<BackendSrv> {
    return {
      request: this.request.bind(this),
    };
  }

  request(options: BackendSrvRequest): Promise<any> {
    return Promise.reject('not implemented');
  }
}
