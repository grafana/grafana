import { t } from '@grafana/i18n';

// Invisible Unicode characters commonly introduced by copy-paste from
// rich text sources (web pages, PDFs, chat apps).
// Includes:
//   - Formatting/directional marks (U+034F, U+061C, U+200B–U+200F, U+202A–U+202E, U+2066–U+2069)
//   - Zero-width and word joiners (U+2060–U+2064, U+FEFF)
//   - Unicode whitespace that looks like a normal space but breaks btoa()
//     (U+2000–U+200A, U+202F, U+205F, U+3000)
//   - Other invisibles (U+00AD soft hyphen, U+180E, U+2028/2029, U+FFF9–U+FFFB)
// Excludes \n, \r, \t, and regular spaces (U+0020, U+00A0) which are legitimate in PEM keys.
const HIDDEN_CHARS_REGEX =
  /[\u00AD\u034F\u061C\u180E\u2000-\u200F\u2028\u2029\u202A-\u202F\u205F\u2060-\u2064\u2066-\u2069\u3000\uFEFF\uFFF9-\uFFFB]/;

/**
 * react-hook-form `validate` function.
 * Returns `true` when valid, or an error message string when hidden characters are detected.
 */
export function validateNoHiddenCharacters(value: string | undefined): string | true {
  if (!value || !HIDDEN_CHARS_REGEX.test(value)) {
    return true;
  }

  return t(
    'provisioning.validation.hidden-characters',
    'This field contains hidden characters that may have been introduced by copying and pasting. Please retype or clean the value and try again.'
  );
}

/**
 * react-hook-form `validate` function.
 * Rejects URLs that embed credentials in the userinfo component (e.g. https://user:token@host/...).
 * Returns `true` when valid, or an error message string when credentials are detected.
 */
export function validateNoUserInfoInUrl(value: string | undefined): string | true {
  const trimmed = value?.trim();
  if (!trimmed) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.username !== '' || parsed.password !== '') {
      return t(
        'provisioning.validation.url-with-credentials',
        'Repository URL must not include a username or password. Remove credentials from the URL and use the token field instead.'
      );
    }
  } catch {
    // Malformed URL — defer to the per-provider regex pattern for the format error.
    return true;
  }

  return true;
}
