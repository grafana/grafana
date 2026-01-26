import { HttpResponse, http } from 'msw';

interface TestRequestBody {
  integration: {
    uid?: string;
    type: string;
    settings: Record<string, unknown>;
  };
  alert: {
    labels: Record<string, string>;
    annotations: Record<string, string>;
  };
}

const testReceiverK8sHandler = () =>
  http.post<{ namespace: string; name: string }, TestRequestBody>(
    '/apis/alertingnotifications.grafana.app/v0alpha1/namespaces/:namespace/receivers/:name/test',
    async ({ request }) => {
      const body = await request.json();

      // Validate request structure
      if (!body.alert) {
        return HttpResponse.json({ message: 'alert is required' }, { status: 400 });
      }

      if (!body.integration) {
        return HttpResponse.json({ message: 'integration is required' }, { status: 400 });
      }

      // Simulate successful test
      return HttpResponse.json({
        apiVersion: 'notifications.alerting.grafana.app/v0alpha1',
        kind: 'CreateReceiverIntegrationTest',
        status: 'success',
        duration: '150ms',
      });
    }
  );

const handlers = [testReceiverK8sHandler()];
export default handlers;
