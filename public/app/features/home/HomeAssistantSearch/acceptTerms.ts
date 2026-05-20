import { getBackendSrv } from '@grafana/runtime';

const ASSISTANT_ACCEPT_TERMS_URL = '/api/plugins/grafana-assistant-app/resources/api/v1/settings/accept-terms';
const TERMS_REFRESH_EVENT = 'grafana-assistant-terms-and-conditions-refresh';

export async function acceptAssistantTerms(): Promise<void> {
  await getBackendSrv().put(ASSISTANT_ACCEPT_TERMS_URL, { acceptedTermsAndConditions: true });
  document.dispatchEvent(new CustomEvent(TERMS_REFRESH_EVENT));
}
