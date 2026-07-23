import { config, getBackendSrv } from '@grafana/runtime';
import { getAPINamespace } from 'app/api/utils';

import { CONNECTIONS_URL } from '../constants';
import { type OAuthConnectionType } from '../types';

const AUTHORIZE_URLS: Record<Exclude<OAuthConnectionType, 'githubEnterpriseOAuth'>, string> = {
  githubOAuth: 'https://github.com/login/oauth/authorize',
  gitlab: 'https://gitlab.com/oauth/authorize',
  bitbucket: 'https://bitbucket.org/site/oauth2/authorize',
};

// localStorage (not sessionStorage) so the state survives into the
// authorization tab, which does not share session storage.
const STATE_STORAGE_PREFIX = 'grafana.provisioning.oauth.';
const COMPLETION_CHANNEL = 'grafana.provisioning.oauth';

export function isOAuthConnectionType(type?: string): type is OAuthConnectionType {
  return type === 'githubOAuth' || type === 'githubEnterpriseOAuth' || type === 'gitlab' || type === 'bitbucket';
}

export function startOAuthAuthorization(
  type: OAuthConnectionType,
  clientID: string,
  connectionName: string,
  serverUrl?: string
) {
  window.location.href = buildOAuthAuthorizeUrl(type, clientID, connectionName, serverUrl);
}

export function buildOAuthAuthorizeUrl(
  type: OAuthConnectionType,
  clientID: string,
  connectionName: string,
  serverUrl?: string,
  opts?: { popup?: boolean }
) {
  const state = window.crypto.randomUUID();
  const redirectUri = getOAuthCallbackUri();

  window.localStorage.setItem(
    `${STATE_STORAGE_PREFIX}${state}`,
    JSON.stringify({ name: connectionName, redirectUri, popup: opts?.popup })
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
  if (type === 'githubOAuth' || type === 'githubEnterpriseOAuth') {
    params.set('scope', 'repo');
  }

  const authorizeUrl =
    type === 'githubEnterpriseOAuth'
      ? `${(serverUrl ?? '').replace(/\/+$/, '')}/login/oauth/authorize`
      : AUTHORIZE_URLS[type];

  return `${authorizeUrl}?${params.toString()}`;
}

export async function completeOAuthAuthorization(
  code: string,
  state: string
): Promise<{ name: string; popup?: boolean }> {
  const key = `${STATE_STORAGE_PREFIX}${state}`;
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    throw new Error('unknown authorization state');
  }
  window.localStorage.removeItem(key);

  const { name, redirectUri, popup } = JSON.parse(raw);
  await getBackendSrv().post(
    `/apis/provisioning.grafana.app/v0alpha1/namespaces/${getAPINamespace()}/connections/${name}/authorize`,
    { code, redirectUri }
  );

  const channel = new BroadcastChannel(COMPLETION_CHANNEL);
  channel.postMessage({ name });
  channel.close();

  return { name, popup };
}

// Subscribes to authorization completions from the callback tab. Returns an unsubscribe function.
export function onOAuthAuthorizationComplete(callback: (connectionName: string) => void) {
  const channel = new BroadcastChannel(COMPLETION_CHANNEL);
  channel.onmessage = (event) => {
    if (typeof event.data?.name === 'string') {
      callback(event.data.name);
    }
  };
  return () => channel.close();
}

export function getOAuthCallbackUri() {
  const subUrl = config.appSubUrl ?? '';
  return `${window.location.origin}${subUrl}${CONNECTIONS_URL}/oauth-callback`;
}
