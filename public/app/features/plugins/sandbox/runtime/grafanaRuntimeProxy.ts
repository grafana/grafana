import { BackendSrv, BackendSrvRequest } from '@grafana/runtime';

import { IFrameBus } from '../iframeBus/iframeBus';
import { SandboxMessage, SandboxMessageType } from '../types';

export class GrafanaRuntimeProxy {
  private iframeBus: IFrameBus<SandboxMessage>;

  constructor(iframeBus: IFrameBus<SandboxMessage>) {
    this.iframeBus = iframeBus;
    this.getBackendSrv = this.getBackendSrv.bind(this);
  }

  getBackendSrv(): Partial<BackendSrv> {
    return {
      request: this.request.bind(this),
    };
  }

  async request<T>(options: BackendSrvRequest): Promise<T> {
    const response = await this.iframeBus.postMessage({
      type: SandboxMessageType.DatasourceBackendSrvRequest,
      payload: options,
    });
    if (response.type === SandboxMessageType.DatasourceBackendSrvResponse) {
      return response.payload;
    }
    throw new Error('unknown response');
  }
}
