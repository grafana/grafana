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
  'client_secret',
  'api_key',
  'api_secret',
  // Public endpoint for most providers, but Slack's `api_url` is its incoming-webhook URL — a
  // bearer credential — and the name alone can't tell the two apart.
  'api_url',
  'service_key',
  'routing_key',
  'secret_key',
  'access_key',
  'webhook_url',
  'bot_token',
  'smtp_auth_password',
  'smtp_auth_secret',
  'slack_api_url',
  'victorops_api_key',
  'opsgenie_api_key',
  'wechat_api_secret',
  'token',
]);

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
  const segments = value.split('/').filter(Boolean);
  return segments.some((segment) => HIGH_ENTROPY_URL_SEGMENT.test(segment) && hasEntropyVariety(segment));
}

function looksLikeSecretValue(value: string): boolean {
  return looksLikeCredentialUrl(value) || looksLikeHighEntropyToken(value);
}

function redactNode(node: unknown, keyName?: string): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => redactNode(item));
  }
  if (node !== null && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, redactNode(value, key)]));
  }
  if (typeof node === 'string') {
    const matchesKnownSecretKey = keyName !== undefined && SECRET_FIELD_NAMES.has(keyName);
    if (matchesKnownSecretKey || looksLikeSecretValue(node)) {
      return REDACTED_VALUE;
    }
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

  const redacted = redactNode(parsed);

  return format === 'json' ? JSON.stringify(redacted, null, 2) : dump(redacted);
}
