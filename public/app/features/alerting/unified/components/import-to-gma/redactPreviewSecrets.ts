import { dump, load } from 'js-yaml';

import type { NotificationChannelOption, NotifierDTO } from '../../types/alerting';

export class PreviewRedactionError extends Error {}

// Secret field paths per Alertmanager receiver YAML key (e.g. 'slack_configs'), each path
// relative to one integration's own config object (e.g. 'api_url', 'http_config.basic_auth.password').
export type SecretFieldMap = Record<string, Set<string>>;

export function buildSecretFieldMap(schemas: NotifierDTO[]): SecretFieldMap {
  const map: SecretFieldMap = {};
  for (const schema of schemas) {
    if (!schema.versions) {
      continue;
    }
    for (const version of schema.versions) {
      const receiverKey = LEGACY_VERSION_TO_RECEIVER_KEY[`${schema.type}:${version.version}`];
      if (!receiverKey) {
        // not a legacy version, or an integration type GMA doesn't import via this path
        continue;
      }

      map[receiverKey] = collectSecurePaths(version.options);
    }
  }
  return map;
}

export function redactPreviewSecrets(
  rawContent: string,
  format: 'yaml' | 'json',
  secretFieldMap: SecretFieldMap
): string {
  let parsed: unknown;
  try {
    parsed = load(rawContent);
  } catch (e) {
    throw new PreviewRedactionError(e instanceof Error ? e.message : String(e));
  }

  const redacted = redactNode(parsed, undefined, [], secretFieldMap);

  return format === 'json' ? JSON.stringify(redacted, null, 2) : dump(redacted);
}

export function containsRedactedValue(content: string): boolean {
  return content.includes(REDACTED_VALUE);
}

// Maps ${schema.type}:${version.version} to the legacy Alertmanager receiver YAML key.
// Verified directly against the grafana/alerting module's integration schema and receiver
// compatibility definitions. 'teams' has two legacy versions (v0mimir1/v0mimir2) mapping to two
// different receiver keys (msteams_configs/msteamsv2_configs) — every other type has one.
const LEGACY_VERSION_TO_RECEIVER_KEY: Record<string, string> = {
  'discord:v0mimir1': 'discord_configs',
  'email:v0mimir1': 'email_configs',
  'pagerduty:v0mimir1': 'pagerduty_configs',
  'slack:v0mimir1': 'slack_configs',
  'webhook:v0mimir1': 'webhook_configs',
  'opsgenie:v0mimir1': 'opsgenie_configs',
  'wechat:v0mimir1': 'wechat_configs',
  'pushover:v0mimir1': 'pushover_configs',
  'victorops:v0mimir1': 'victorops_configs',
  'sns:v0mimir1': 'sns_configs',
  'telegram:v0mimir1': 'telegram_configs',
  'webex:v0mimir1': 'webex_configs',
  'teams:v0mimir1': 'msteams_configs',
  'teams:v0mimir2': 'msteamsv2_configs',
  'jira:v0mimir1': 'jira_configs',
};

function collectSecurePaths(options: NotificationChannelOption[], prefix = ''): Set<string> {
  const paths = new Set<string>();
  for (const field of options) {
    const path = prefix ? `${prefix}.${field.propertyName}` : field.propertyName;
    if (field.secure) {
      paths.add(path);
      continue; // a secure field's own subform (if any) is not walked further
    }
    if (field.subformOptions?.length) {
      for (const p of collectSecurePaths(field.subformOptions, path)) {
        paths.add(p);
      }
    }
  }
  return paths;
}

const REDACTED_VALUE = '<redacted>';

// Everything below is a manual override for secret-ness the schema can't express — kept
// deliberately small now that per-receiver-type fields are derived from buildSecretFieldMap
// instead of a hand-maintained flat name list. `*_file` fields (e.g. `bearer_token_file`,
// `password_file`) are intentionally NOT redacted by name here: Grafana's import backend hard-
// rejects any receiver containing one before it's ever stored, and a `_file` field's value in the
// config text is a filesystem path, not the secret itself, so there's nothing sensitive to hide.

// Alertmanager global-defaults secrets — structurally outside any integration's schema (they live
// under the AM config's top-level `global:` block, not inside a receiver's own options).
const GLOBAL_SECRET_FIELD_NAMES = new Set([
  'slack_api_url',
  'victorops_api_key',
  'opsgenie_api_key',
  'smtp_auth_password',
  'smtp_auth_secret',
]);

// Global-only fields nested under global.http_config — not safe to match by bare key name
// (password/credentials/client_secret aren't unique to this context), so matched by full path
// relative to 'global' instead.
const GLOBAL_SECRET_PATHS = new Set([
  'wechat_api_secret',
  'http_config.basic_auth.password',
  'http_config.authorization.credentials',
  'http_config.oauth2.client_secret',
]);

// TLS key/cert/ca are real, importable secrets the schema deliberately never exposes for any
// receiver type (restriction is on the Mimir/Grafana form UI, not on backend acceptance) — kept
// as a manual override rather than derived.
const TLS_KEY_KEYS = new Set(['key']);

function isSecretField(keyName: string | undefined, path: readonly string[], secretFieldMap: SecretFieldMap): boolean {
  if (keyName === undefined) {
    return false;
  }
  if (path[0] === 'global' && GLOBAL_SECRET_FIELD_NAMES.has(keyName)) {
    return true;
  }
  if (path[0] === 'global' && GLOBAL_SECRET_PATHS.has(path.slice(1).join('.'))) {
    return true;
  }
  // bearer_token lives under every receiver's shared http_config and is always a credential, but
  // the schema never emits a Field for it (a gap in the underlying grafana/alerting schema, not
  // something this file can derive) — redact it unconditionally rather than scoping it per-type.
  if (keyName === 'bearer_token') {
    return true;
  }
  const parentKey = path.length >= 2 ? path[path.length - 2] : undefined;
  if (TLS_KEY_KEYS.has(keyName) && parentKey?.endsWith('tls_config')) {
    return true;
  }
  // http_headers is a map of header name -> {values, secrets}; 'secrets' holds the sensitive
  // header values and 'values' the plain ones. The schema exposes http_headers only as an opaque
  // key-value map, with no way to flag 'secrets' as secure, so this stays a manual check.
  if (keyName === 'secrets' && path.includes('http_headers')) {
    return true;
  }
  // proxy_connect_header is Alertmanager's ProxyHeader map (header name -> list of secret values)
  // sent during proxy CONNECT auth — unlike http_headers, every value under it is a credential,
  // not just a 'secrets' sub-key, so any key directly nested under it is redacted regardless of
  // its own name. Also unmodeled by the schema (same key-value-map limitation as http_headers).
  if (parentKey === 'proxy_connect_header') {
    return true;
  }
  return isSecureUnderNearestReceiver(path, secretFieldMap);
}

// Finds the nearest ancestor key that's a known Alertmanager receiver array (e.g. 'slack_configs'
// — a key present in secretFieldMap), then checks the schema-derived secure paths for that
// integration, relative to entering it. Only reached once keyName is confirmed defined, so path's
// last element is always keyName itself — the scan starts one position before it.
function isSecureUnderNearestReceiver(path: readonly string[], secretFieldMap: SecretFieldMap): boolean {
  for (let i = path.length - 2; i >= 0; i--) {
    const securePaths = secretFieldMap[path[i]];
    if (securePaths) {
      return securePaths.has(path.slice(i + 1).join('.'));
    }
  }
  return false;
}

// Below this length, and with whitespace allowed, we'd start flagging prose and template
// placeholders instead of tokens; real secrets we've seen run well past it. False positives on a
// plain value are the accepted cost here, not false negatives on a secret.
const RANDOM_TOKEN_PATTERN = /^[A-Za-z0-9_\-.]{20,}$/;
const RANDOM_TOKEN_URL_SEGMENT_PATTERN = /^[A-Za-z0-9_-]{12,}$/;

const DIGIT = /\d/;
const LOWERCASE_LETTER = /[a-z]/;
const UPPERCASE_LETTER = /[A-Z]/;

// 2-of-3 character classes, not 1, so a plain lowercase label like `normal-label-that-is-quite-
// long-but-plain-english-words` still passes through unredacted.
function hasMixedCharacterClasses(value: string): boolean {
  const hasDigit = DIGIT.test(value);
  const hasLower = LOWERCASE_LETTER.test(value);
  const hasUpper = UPPERCASE_LETTER.test(value);
  return [hasDigit, hasLower, hasUpper].filter(Boolean).length >= 2;
}

function looksLikeRandomToken(value: string): boolean {
  return RANDOM_TOKEN_PATTERN.test(value) && hasMixedCharacterClasses(value);
}

const HTTP_URL_PROTOCOL = /^https?:\/\//i;

function looksLikeCredentialUrl(value: string): boolean {
  if (!HTTP_URL_PROTOCOL.test(value)) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  // A non-empty userinfo password is unambiguously a credential by construction, unlike a path
  // segment or query param, so it doesn't need the high-entropy heuristic below.
  if (url.password) {
    return true;
  }
  const credentialCandidateSegments = [
    url.username,
    ...url.pathname.split('/').filter(Boolean),
    ...url.searchParams.values(),
  ];
  return credentialCandidateSegments.some(
    (segment) => RANDOM_TOKEN_URL_SEGMENT_PATTERN.test(segment) && hasMixedCharacterClasses(segment)
  );
}

function looksLikeSecretValue(value: string): boolean {
  return looksLikeCredentialUrl(value) || looksLikeRandomToken(value);
}

function redactNode(
  node: unknown,
  keyName: string | undefined,
  path: readonly string[],
  secretFieldMap: SecretFieldMap
): unknown {
  if (isSecretField(keyName, path, secretFieldMap)) {
    return REDACTED_VALUE;
  }
  if (Array.isArray(node)) {
    return node.map((item) => redactNode(item, undefined, path, secretFieldMap));
  }
  if (node !== null && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [key, redactNode(value, key, [...path, key], secretFieldMap)])
    );
  }
  if (typeof node === 'string' && looksLikeSecretValue(node)) {
    return REDACTED_VALUE;
  }
  return node;
}
