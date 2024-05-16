import { http, HttpResponse } from 'msw';

export const MOCK_GRAFANA_ALERT_RULE_TITLE = 'Test alert';

const alertRuleDetailsHandler = () =>
  http.get<{ folderUid: string }>(`/api/ruler/:ruler/api/v1/rule/:uid`, () => {
    // TODO: Scaffold out alert rule response logic as this endpoint is used more in tests
    return HttpResponse.json({
      grafana_alert: {
        title: MOCK_GRAFANA_ALERT_RULE_TITLE,
      },
    });
  });

const handlers = [alertRuleDetailsHandler()];
export default handlers;
