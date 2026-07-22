import { config, getBackendSrv } from '@grafana/runtime';
import { getAPINamespace } from 'app/api/utils';

import { CONNECTIONS_URL } from '../constants';
import { type OAuthConnectionType } from '../types';

const AUTHORIZE_URLS: Record<OAuthConnectionType, string> = {
  gitlab: 'https://gitlab.com/oauth/authorize',
  bitbucket: 'https://bitbucket.org/site/oauth2/authorize',
};

const STATE_STORAGE_PREFIX = 'grafana.provisioning.oauth.';

export function startOAuthAuthorization(type: OAuthConnectionType, clientID: string, connectionName: string) {
  const state = window.crypto.randomUUID();
  const redirectUri = getOAuthCallbackUri();

  window.sessionStorage.setItem(
    `${STATE_STORAGE_PREFIX}${state}`,
    JSON.stringify({ name: connectionName, redirectUri })
  );

  const params = new URLSearchParams({
    client_id: clientID,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });
  if (type === 'gitlab') {
    params.set('scope', 'api');
  }

  window.location.href = `${AUTHORIZE_URLS[type]}?${params.toString()}`;
}

export async function completeOAuthAuthorization(code: string, state: string): Promise<string> {
  const key = `${STATE_STORAGE_PREFIX}${state}`;
  const raw = window.sessionStorage.getItem(key);
  if (!raw) {
    throw new Error('unknown authorization state');
  }
  window.sessionStorage.removeItem(key);

  const { name, redirectUri } = JSON.parse(raw);
  await getBackendSrv().post(
    `/apis/provisioning.grafana.app/v0alpha1/namespaces/${getAPINamespace()}/connections/${name}/authorize`,
    { code, redirectUri }
  );

  return name;
}

export function getOAuthCallbackUri() {
  const subUrl = config.appSubUrl ?? '';
  return `${window.location.origin}${subUrl}${CONNECTIONS_URL}/oauth-callback`;
}
