import { t } from '@grafana/i18n';

import { HEALTH_VALUES, STATE_VALUES } from './criteria';
import { type CriteriaIssue } from './criteriaIssues';
import { TOKEN_KEYS, type TokenDefinition } from './tokens';

// Aliases such as `err` and `inactive` still parse, but suggesting them would only add noise.
const FIXED_VALUES: Record<string, string[]> = {
  [TOKEN_KEYS.state]: STATE_VALUES.filter((value) => value !== 'inactive'),
  [TOKEN_KEYS.health]: HEALTH_VALUES.filter((value) => value !== 'err'),
  [TOKEN_KEYS.paused]: ['true', 'false'],
  [TOKEN_KEYS.plugins]: ['hide'],
};

// Tokens people type from other tools or from memory, mapped to the filter that does what they meant.
const KNOWN_CONFUSIONS: Record<string, string> = {
  'state:error': 'health:error',
  'state:nodata': 'health:nodata',
  'is:paused': 'paused:true',
};

/** One line per distinct problem with an unsupported token, saying what would work instead. */
export function getIssueHints(issues: CriteriaIssue[], tokens: TokenDefinition[]): string[] {
  const validKeys = tokens.map((token) => token.key);
  const hints = new Set<string>();

  for (const issue of issues) {
    if (issue.reason !== 'unsupported' || !issue.raw) {
      continue;
    }
    const hint = getHint(issue.raw, validKeys);
    if (hint) {
      hints.add(hint);
    }
  }

  return [...hints];
}

function getHint(raw: string, validKeys: string[]): string | undefined {
  const separator = raw.indexOf(':');
  if (separator < 0) {
    return undefined;
  }
  const key = raw.slice(0, separator);
  const value = raw.slice(separator + 1).replace(/^"|"$/g, '');

  const suggestion = KNOWN_CONFUSIONS[`${key}:${value.toLowerCase()}`];
  if (suggestion && validKeys.includes(suggestion.split(':')[0])) {
    return t('alerting.gma-rule-list.search.hint-use-instead', '{{typed}} is not a valid filter. Use {{suggestion}}.', {
      typed: `${key}:${value}`,
      suggestion,
    });
  }

  if (!validKeys.includes(key)) {
    return t('alerting.gma-rule-list.search.hint-unknown-key', 'Unknown filter {{key}}. Valid filters: {{keys}}.', {
      key,
      keys: validKeys.join(', '),
    });
  }

  const validValues = FIXED_VALUES[key];
  if (validValues && !isAcceptedValue(key, value)) {
    return t('alerting.gma-rule-list.search.hint-valid-values', '{{key}} accepts: {{values}}.', {
      key,
      values: validValues.join(', '),
    });
  }

  return undefined;
}

/** Accepts what the parser accepts, aliases included, so a hint never calls a working value wrong. */
function isAcceptedValue(key: string, value: string): boolean {
  if (key === TOKEN_KEYS.state) {
    return STATE_VALUES.some((accepted) => accepted === value.toLowerCase());
  }
  if (key === TOKEN_KEYS.health) {
    return HEALTH_VALUES.some((accepted) => accepted === value.toLowerCase());
  }
  return FIXED_VALUES[key].includes(value);
}
