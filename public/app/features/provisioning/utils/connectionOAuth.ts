import { store } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { getAPINamespace } from 'app/api/utils';

import { type RepoType } from '../Wizard/types';
import { CONNECTIONS_URL } from '../constants';
import { type OAuthConnectionType } from '../types';

const AUTHORIZE_URLS: Record<Exclude<OAuthConnectionType, 'githubEnterpriseOAuth'>, string> = {
  githubOAuth: 'https://github.com/login/oauth/authorize',
  gitlab: 'https://gitlab.com/oauth/authorize',
  bitbucket: 'https://bitbucket.org/site/oauth2/authorize',
};

// Backed by localStorage (not sessionStorage) so the state survives into the
// authorization tab, which does not share session storage.
const STATE_STORAGE_KEY = 'grafana.provisioning.oauth.states';
const STATE_TTL_MS = 60 * 60 * 1000;
const COMPLETION_CHANNEL = 'grafana.provisioning.oauth';

interface StoredAuthorizeState {
  name: string;
  redirectUri: string;
  popup?: boolean;
  createdAt: number;
}

export function isOAuthConnectionType(type?: string): type is OAuthConnectionType {
  return type === 'githubOAuth' || type === 'githubEnterpriseOAuth' || type === 'gitlab' || type === 'bitbucket';
}

export function oauthConnectionRepoType(type: OAuthConnectionType): RepoType {
  switch (type) {
    case 'githubOAuth':
      return 'github';
    case 'githubEnterpriseOAuth':
      return 'githubEnterprise';
    default:
      return type;
  }
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

  const states = readAuthorizeStates();
  states[state] = { name: connectionName, redirectUri, popup: opts?.popup, createdAt: Date.now() };
  store.setObject(STATE_STORAGE_KEY, states);

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
  const states = readAuthorizeStates();
  const entry = states[state];
  if (!entry) {
    throw new Error('unknown authorization state');
  }
  delete states[state];
  store.setObject(STATE_STORAGE_KEY, states);

  const { name, redirectUri, popup } = entry;
  await getBackendSrv().post(
    `/apis/provisioning.grafana.app/v0alpha1/namespaces/${getAPINamespace()}/connections/${name}/authorize`,
    {
      apiVersion: 'provisioning.grafana.app/v0alpha1',
      kind: 'ConnectionAuthorizeRequest',
      spec: { code, redirectURI: redirectUri },
    }
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

// Abandoned flows never consume their state entry, so drop expired ones on read.
function readAuthorizeStates(): Record<string, StoredAuthorizeState> {
  const states = store.getObject<Record<string, StoredAuthorizeState>>(STATE_STORAGE_KEY, {});
  const now = Date.now();
  return Object.fromEntries(
    Object.entries(states).filter(([, entry]) => entry?.createdAt && now - entry.createdAt <= STATE_TTL_MS)
  );
}
