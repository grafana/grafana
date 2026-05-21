import { ASSISTANT_PLUGIN_ID, TERMS_AND_CONDITIONS_REFRESH_EVENT } from '@grafana/assistant';
import { getBackendSrv } from '@grafana/runtime';

export async function acceptAssistantTerms(): Promise<void> {
  await getBackendSrv().put(`/api/plugins/${ASSISTANT_PLUGIN_ID}/resources/api/v1/settings/accept-terms`, {
    acceptedTermsAndConditions: true,
  });
  document.dispatchEvent(new CustomEvent(TERMS_AND_CONDITIONS_REFRESH_EVENT));
}
