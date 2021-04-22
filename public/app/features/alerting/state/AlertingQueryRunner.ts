import { GrafanaQuery } from '../../../types/unified-alerting-dto';
import { getBackendSrv } from '../../../core/services/backend_srv';
import { BackendSrvRequest } from '../../../../../packages/grafana-runtime';

export class AlertingQueryRunner {
  async run(queries: GrafanaQuery[]) {
    const data = { data: queries };
    const request: BackendSrvRequest = {
      data: data,
      url: '/api/v1/eval',
      method: 'POST',
    };
    const result = await getBackendSrv().fetch(request).toPromise();
    console.log(result);
  }
}
