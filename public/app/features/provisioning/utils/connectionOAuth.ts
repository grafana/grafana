import { generateUUID, store, textUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getBackendSrv } from '@grafana/runtime';
import { type ConnectionSpec } from 'app/api/clients/provisioning/v0alpha1';
import { extractErrorMessage, getAPINamespace } from 'app/api/utils';

import { CONNECTIONS_URL } from '../constants';
import { type OAuthConnectionType } from '../types';

import { getServerOrigin } from './git';

const AUTHORIZE_URLS: Record<Exclude<OAuthConnectionType, 'githubEnterpriseOAuth'>, string> = {
  githubOAuth: 'https://github.com/login/oauth/authorize',
  gitlabOAuth: 'https://gitlab.com/oauth/authorize',
  bitbucketOAuth: 'https://bitbucket.org/site/oauth2/authorize',
};

// localStorage (not sessionStorage) so the state survives into the
// authorization tab, which does not share session storage.
const STATE_STORAGE_PREFIX = 'grafana.provisioning.oauth.';
const COMPLETION_CHANNEL = 'grafana.provisioning.oauth';

// Abandoned authorizations never get their state consumed; sweep old entries
// so they don't accumulate in localStorage. One hour comfortably outlives any
// real authorization round-trip.
const STATE_TTL_MS = 60 * 60 * 1000;

function sweepStaleOAuthStates() {
  for (const [key, raw] of Object.entries(store.all(STATE_STORAGE_PREFIX))) {
    try {
      const { createdAt } = JSON.parse(raw);
      if (typeof createdAt !== 'number' || Date.now() - createdAt > STATE_TTL_MS) {
        store.delete(`${STATE_STORAGE_PREFIX}${key}`);
      }
    } catch {
      store.delete(`${STATE_STORAGE_PREFIX}${key}`);
    }
  }
}

const OAUTH_TO_PROVIDER = {
  githubOAuth: 'github',
  githubEnterpriseOAuth: 'githubEnterprise',
  gitlabOAuth: 'gitlab',
  bitbucketOAuth: 'bitbucket',
} as const;

export function isOAuthConnectionType(type?: string): type is OAuthConnectionType {
  return type != null && type in OAUTH_TO_PROVIDER;
}

// OAuth app connections talk to the same provider as their app-based counterparts
export function connectionProviderType(
  type?: ConnectionSpec['type']
): 'github' | 'githubEnterprise' | 'gitlab' | 'bitbucket' | undefined {
  return isOAuthConnectionType(type) ? OAUTH_TO_PROVIDER[type] : type;
}

export function buildOAuthAuthorizeUrl(
  type: OAuthConnectionType,
  clientID: string,
  connectionName: string,
  serverUrl?: string,
  opts?: { popup?: boolean }
) {
  const state = generateUUID();
  const redirectUri = getOAuthCallbackUri();

  sweepStaleOAuthStates();
  store.set(
    `${STATE_STORAGE_PREFIX}${state}`,
    JSON.stringify({ name: connectionName, redirectUri, popup: opts?.popup, createdAt: Date.now() })
  );

  const params = new URLSearchParams({
    client_id: clientID,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });
  if (type === 'gitlabOAuth') {
    params.set('scope', 'api');
  }
  if (type === 'githubOAuth' || type === 'githubEnterpriseOAuth') {
    params.set('scope', 'repo');
  }

  const authorizeUrl =
    type === 'githubEnterpriseOAuth'
      ? // GHES hosts its OAuth endpoints at the server root; drop any path (e.g. /api/v3)
        `${getServerOrigin(serverUrl) || (serverUrl ?? '').replace(/\/+$/, '')}/login/oauth/authorize`
      : AUTHORIZE_URLS[type];

  return textUtil.sanitizeUrl(`${authorizeUrl}?${params.toString()}`);
}

// Notifies the tab that started the authorization (see onOAuthAuthorizationComplete).
function broadcastCompletion(name: string, error?: string) {
  const channel = new BroadcastChannel(COMPLETION_CHANNEL);
  channel.postMessage({ name, error });
  channel.close();
}

// Reports a failed authorization (e.g. the user denied consent) back to the
// waiting tab so it does not stay stuck on the pending state.
export function failOAuthAuthorization(state: string, error: string): { name: string; popup?: boolean } | undefined {
  const key = `${STATE_STORAGE_PREFIX}${state}`;
  const raw = store.get(key);
  if (!raw) {
    return undefined;
  }
  store.delete(key);

  const { name, popup } = JSON.parse(raw);
  broadcastCompletion(name, error);

  return { name, popup };
}

export async function completeOAuthAuthorization(
  code: string,
  state: string
): Promise<{ name: string; popup?: boolean; error?: string }> {
  const key = `${STATE_STORAGE_PREFIX}${state}`;
  const raw = store.get(key);
  if (!raw) {
    throw new Error(
      t(
        'provisioning.connection-oauth.error-state-expired',
        'This authorization link has expired or was already used. Start the authorization again.'
      )
    );
  }
  store.delete(key);

  const { name, redirectUri, popup } = JSON.parse(raw);
  let error: string | undefined;
  try {
    await getBackendSrv().post(
      `/apis/provisioning.grafana.app/v0alpha1/namespaces/${getAPINamespace()}/connections/${name}/authorize`,
      {
        apiVersion: 'provisioning.grafana.app/v0alpha1',
        kind: 'ConnectionAuthorizeRequest',
        spec: { code, redirectURI: redirectUri },
      }
    );
  } catch (err) {
    error =
      extractErrorMessage(err) ||
      t('provisioning.connection-oauth.error-authorize-failed', 'Failed to complete authorization');
  }

  broadcastCompletion(name, error);

  return { name, popup, error };
}

// Subscribes to authorization completions from the callback tab. Returns an unsubscribe function.
export function onOAuthAuthorizationComplete(callback: (connectionName: string, error?: string) => void) {
  const channel = new BroadcastChannel(COMPLETION_CHANNEL);
  channel.onmessage = (event) => {
    if (typeof event.data?.name === 'string') {
      callback(event.data.name, typeof event.data.error === 'string' ? event.data.error : undefined);
    }
  };
  return () => channel.close();
}

export function getOAuthCallbackUri() {
  const subUrl = config.appSubUrl ?? '';
  return `${window.location.origin}${subUrl}${CONNECTIONS_URL}/oauth-callback`;
}
