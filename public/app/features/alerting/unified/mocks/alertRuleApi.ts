import { http, HttpResponse } from 'msw';
import { SetupServer } from 'msw/node';

import { PromRulesResponse } from 'app/types/unified-alerting-dto';

import { PreviewResponse, PREVIEW_URL, PROM_RULES_URL } from '../api/alertRuleApi';

export function mockPreviewApiResponse(server: SetupServer, result: PreviewResponse) {
  server.use(http.post(PREVIEW_URL, () => HttpResponse.json(result)));
}

export function mockPromRulesApiResponse(server: SetupServer, result: PromRulesResponse) {
  server.use(http.get(PROM_RULES_URL, () => HttpResponse.json(result)));
}

export const MOCK_GRAFANA_ALERT_RULE_TITLE = 'Test alert';

export const alertRuleDetailsHandler = () =>
  http.get<{ folderUid: string }>(`/api/ruler/:ruler/api/v1/rule/:uid`, () => {
    // TODO: Scaffold out alert rule response logic as this endpoint is used more in tests
    return HttpResponse.json({
      grafana_alert: {
        title: MOCK_GRAFANA_ALERT_RULE_TITLE,
      },
    });
  });
