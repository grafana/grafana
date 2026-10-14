import { type Criteria, createEmptyCriteria } from './criteria';
import { parseLabelValue } from './labelMatcher';
import { tokenize } from './tokenizer';
import { type ParseResult, type ParsedToken, TOKEN_KEYS, type TokenDefinition, buildTokenRegistry } from './tokens';

/**
 * Parses a flat search string into an ordered token list (for later caret-based editing)
 * and a canonical Criteria object. Tokens whose key is not in `registry`, and tokens that
 * are still incomplete (e.g. `label:` with no value yet, or an unterminated quote), are
 * preserved in the token list but never contribute to `criteria` — see README.md.
 */
export function parse(input: string, registry: TokenDefinition[]): ParseResult {
  const byKey = buildTokenRegistry(registry);
  const criteria = createEmptyCriteria();
  const tokens: ParsedToken[] = [];

  for (const raw of tokenize(input)) {
    if (raw.key === null) {
      tokens.push({ ...raw, known: true, incomplete: false });
      if (raw.value.length > 0) {
        criteria.text.push(raw.value);
      }
      continue;
    }

    const known = byKey.has(raw.key);
    const incomplete = raw.value.length === 0 || (raw.quoted && !raw.closed);
    tokens.push({ ...raw, known, incomplete });

    if (known && !incomplete) {
      applyToken(criteria, raw.key, raw.value);
    }
  }

  return { tokens, criteria };
}

function applyToken(criteria: Criteria, key: string, value: string): void {
  switch (key) {
    case TOKEN_KEYS.rule:
      criteria.text.push(value);
      return;
    case TOKEN_KEYS.namespace:
      criteria.namespaces.push(value);
      return;
    case TOKEN_KEYS.datasource:
      criteria.dataSourceUids.push(value);
      return;
    case TOKEN_KEYS.label: {
      const matcher = parseLabelValue(value);
      if (matcher) {
        criteria.labels.push(matcher);
      }
      return;
    }
    case TOKEN_KEYS.plugins:
      if (value === 'hide') {
        criteria.hidePluginRules = true;
      }
      return;
    case TOKEN_KEYS.health:
      criteria.health = value;
      return;
    case TOKEN_KEYS.state:
      criteria.state = value;
      return;
    case TOKEN_KEYS.dashboard:
      criteria.dashboardUid = value;
      return;
    case TOKEN_KEYS.panelId:
      criteria.panelId = value;
      return;
    case TOKEN_KEYS.contactPoint:
      criteria.contactPoint = value;
      return;
    case TOKEN_KEYS.policy:
      criteria.policy = value;
      return;
    case TOKEN_KEYS.paused:
      if (value === 'true' || value === 'false') {
        criteria.paused = value;
      }
      return;
    case TOKEN_KEYS.metric:
      criteria.metric = value;
      return;
    case TOKEN_KEYS.targetDatasource:
      criteria.targetDataSourceUid = value;
      return;
    default:
      return;
  }
}
