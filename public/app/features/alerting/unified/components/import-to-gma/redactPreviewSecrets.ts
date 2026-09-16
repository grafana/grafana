import { dump, load } from 'js-yaml';

export class PreviewRedactionError extends Error {}

const REDACTED_VALUE = '<redacted>';

const SECRET_FIELD_NAMES = new Set([
  'password',
  'password_file',
  'auth_password',
  'auth_secret',
  'bearer_token',
  'bearer_token_file',
  'credentials',
  'credentials_file',
  'client_secret',
  'client_secret_file',
  'client_certificate_key',
  'client_certificate_key_file',
  'api_key',
  'api_key_file',
  'api_secret',
  // Public endpoint for most providers, but Slack's `api_url` is its incoming-webhook URL — a
  // bearer credential — and the name alone can't tell the two apart.
  'api_url',
  'service_key',
  'routing_key',
  'secret_key',
  'access_key',
  'webhook_url',
  'webhook_url_file',
  'bot_token',
  'user_key',
  'user_key_file',
  'token',
  'token_file',
  'auth_password_file',
  'smtp_auth_password',
  'smtp_auth_password_file',
  'smtp_auth_secret',
  'slack_api_url',
  'victorops_api_key',
  'victorops_api_key_file',
  'opsgenie_api_key',
  'opsgenie_api_key_file',
  'wechat_api_secret',
]);

// Same field name, different secret-ness depending on which receiver or config block it's under —
// name alone can't disambiguate, so these are only redacted when the immediate parent key matches.
const WEBHOOK_URL_KEYS = new Set(['url', 'url_file']);
const TLS_KEY_KEYS = new Set(['key', 'key_file']);

function isSecretField(keyName: string | undefined, path: readonly string[]): boolean {
  if (keyName === undefined) {
    return false;
  }
  if (SECRET_FIELD_NAMES.has(keyName)) {
    return true;
  }
  const parentKey = path.length >= 2 ? path[path.length - 2] : undefined;
  if (WEBHOOK_URL_KEYS.has(keyName) && parentKey === 'webhook_configs') {
    return true;
  }
  if (TLS_KEY_KEYS.has(keyName) && parentKey?.endsWith('tls_config')) {
    return true;
  }
  if (keyName === 'secrets' && path.includes('http_headers')) {
    return true;
  }
  return false;
}

// Below this length, and with whitespace allowed, we'd start flagging prose and template
// placeholders instead of tokens; real secrets we've seen run well past it. False positives on a
// plain value are the accepted cost here, not false negatives on a secret.
const HIGH_ENTROPY_VALUE = /^[A-Za-z0-9_\-.]{20,}$/;
const HIGH_ENTROPY_URL_SEGMENT = /^[A-Za-z0-9_-]{12,}$/;

const DIGIT = /\d/;
const LOWERCASE_LETTER = /[a-z]/;
const UPPERCASE_LETTER = /[A-Z]/;

// 2-of-3 character classes, not 1, so a plain lowercase label like `normal-label-that-is-quite-
// long-but-plain-english-words` still passes through unredacted.
function hasEntropyVariety(value: string): boolean {
  const hasDigit = DIGIT.test(value);
  const hasLower = LOWERCASE_LETTER.test(value);
  const hasUpper = UPPERCASE_LETTER.test(value);
  return [hasDigit, hasLower, hasUpper].filter(Boolean).length >= 2;
}

function looksLikeHighEntropyToken(value: string): boolean {
  return HIGH_ENTROPY_VALUE.test(value) && hasEntropyVariety(value);
}

const URL_PROTOCOL = /^https?:\/\//i;

function looksLikeCredentialUrl(value: string): boolean {
  if (!URL_PROTOCOL.test(value)) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const candidates = [
    url.username,
    url.password,
    ...url.pathname.split('/').filter(Boolean),
    ...url.searchParams.values(),
  ];
  return candidates.some((candidate) => HIGH_ENTROPY_URL_SEGMENT.test(candidate) && hasEntropyVariety(candidate));
}

function looksLikeSecretValue(value: string): boolean {
  return looksLikeCredentialUrl(value) || looksLikeHighEntropyToken(value);
}

function redactNode(node: unknown, keyName: string | undefined, path: readonly string[]): unknown {
  if (isSecretField(keyName, path)) {
    return REDACTED_VALUE;
  }
  if (Array.isArray(node)) {
    return node.map((item) => redactNode(item, undefined, path));
  }
  if (node !== null && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [key, redactNode(value, key, [...path, key])])
    );
  }
  if (typeof node === 'string' && looksLikeSecretValue(node)) {
    return REDACTED_VALUE;
  }
  return node;
}

export function redactPreviewSecrets(rawContent: string, format: 'yaml' | 'json'): string {
  let parsed: unknown;
  try {
    parsed = load(rawContent);
  } catch (e) {
    throw new PreviewRedactionError(e instanceof Error ? e.message : String(e));
  }

  const redacted = redactNode(parsed, undefined, []);

  return format === 'json' ? JSON.stringify(redacted, null, 2) : dump(redacted);
}
