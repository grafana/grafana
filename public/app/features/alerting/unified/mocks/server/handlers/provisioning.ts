// POST /apis/notifications.alerting.grafana.app/v0alpha1/namespaces/default/timeintervals

import { HttpResponse, HttpResponseResolver, http } from 'msw';

const getProvisioningHelper: HttpResponseResolver = ({ request }) => {
  const url = new URL(request.url);
  const format = url.searchParams.get('format');
  if (format === 'yaml') {
    // TODO: Return realistic mocked YAML
    return HttpResponse.text('', { headers: { 'Content-Type': 'text/yaml' } });
  }
  // TODO: Return realistic mocked JSON
  return HttpResponse.json({});
};

const exportMuteTimingsHandler = () => http.get('/api/v1/provisioning/mute-timings/export', getProvisioningHelper);
const exportSpecificMuteTimingsHandler = () =>
  http.get('/api/v1/provisioning/mute-timings/:name/export', getProvisioningHelper);

// Used by folder picker to load provisioning settings
const provisioningSettingsHandler = () =>
  http.get('/apis/provisioning.grafana.app/v0alpha1/namespaces/default/settings', () =>
    HttpResponse.json({ items: [] })
  );

const handlers = [exportMuteTimingsHandler(), exportSpecificMuteTimingsHandler(), provisioningSettingsHandler()];
export default handlers;
