import { attempt, isError } from 'lodash';

import { isDefaultRoutingTreeName } from '@grafana/alerting/unstable';

import { parseMatcher } from '../../utils/matchers';
import { type RuleKind } from '../shared/ruleKind';

import { alertFilters } from './alertFilters';
import { type FilterDefinition, type FilterKey, indexByKey } from './filterDefinitions';
import { recordingFilters } from './recordingFilters';
import {
  DEFAULT_POLICY,
  HEALTH_API_VALUES,
  type HealthValue,
  type RuleSearchFilter,
  STATE_API_VALUES,
  type SearchLabelMatcher,
  type StateValue,
  createEmptyFilter,
} from './ruleSearchFilter';
import { tokenize } from './tokenizer';

/** A reason the page can't search the query as typed; the page shows each one and sends no request. */
export type FilterIssue =
  | { key: string; reason: 'invalid' | 'unavailable' }
  | { key: string; reason: 'renamed'; from: string; to: string }
  | { key: null; reason: 'wildcardInText' | 'unclosedQuote' }
  /** The rule search refused the request; `key` is null when the refusal names no filter, or the search text. */
  | { key: string | null; reason: 'rejected'; message: string };

export interface ParsedSearch {
  filter: RuleSearchFilter;
  issues: FilterIssue[];
}

/**
 * Parses the query into a filter, then gives feedback on the result. Parsing rejects only a value the
 * filter can't hold; feedback judges what parsing accepted, so `state:bogus` is a parse rejection and
 * `folder:f*` is feedback.
 */
export function parse(query: string, kind: RuleKind): ParsedSearch {
  const { filter, rejected } = parseFilter(query, filtersFor(kind));
  return { filter, issues: getFeedback(filter, rejected, kind) };
}

export function filtersFor(kind: RuleKind): FilterDefinition[] {
  return kind === 'alert' ? alertFilters : recordingFilters;
}

// Parsing

/** A token parsing couldn't turn into a filter value; `key` is null for free text with an unclosed quote. */
interface RejectedToken {
  key: string | null;
  /** A renamed value as typed, and the value that replaces it. */
  renamed?: { from: string; to: string };
}

function parseFilter(
  query: string,
  filters: FilterDefinition[]
): { filter: RuleSearchFilter; rejected: RejectedToken[] } {
  const byKey = indexByKey(filters);
  const filter = createEmptyFilter();
  const rejected: RejectedToken[] = [];

  for (const raw of tokenize(query)) {
    const definition = raw.key === null ? undefined : byKey.get(raw.key);

    // A key this page has no filter for is part of a title, e.g. a rule named `foo:bar`.
    if (definition === undefined) {
      if (!raw.closed) {
        rejected.push({ key: null });
      } else if (raw.key !== null) {
        filter.text.push(`${raw.key}:${raw.value}`);
      } else if (raw.value.length > 0) {
        filter.text.push(raw.value);
      }
      continue;
    }

    const accepted = raw.value.length > 0 && raw.closed && applyToken(filter, definition.key, raw.value);
    if (!accepted) {
      const to = RENAMED_VALUES[definition.key]?.[raw.value.toLowerCase()];
      rejected.push(to ? { key: definition.key, renamed: { from: raw.value, to } } : { key: definition.key });
    }
  }

  return { filter, rejected };
}

// RuleList.v2 calls the normal state `inactive`, so its links and users' habits still use it.
const RENAMED_VALUES: Partial<Record<FilterKey, Record<string, string>>> = { state: { inactive: 'normal' } };

/** Returns false, leaving `filter` untouched, when the token rejects `value`. */
function applyToken(filter: RuleSearchFilter, key: FilterKey, value: string): boolean {
  switch (key) {
    case 'rule':
      filter.text.push(value);
      return true;
    case 'folder':
      filter.folders.push(value);
      return true;
    case 'datasource':
      filter.dataSourceUids.push(value);
      return true;
    case 'label': {
      const matcher = parseLabelValue(value);
      if (matcher) {
        filter.labels.push(matcher);
      }
      return Boolean(matcher);
    }
    case 'plugins':
      if (value === 'hide') {
        filter.hidePluginRules = true;
        return true;
      }
      return false;
    case 'health': {
      const health = value.toLowerCase();
      if (isHealthValue(health)) {
        filter.health = health;
        return true;
      }
      return false;
    }
    case 'state': {
      const state = value.toLowerCase();
      if (isStateValue(state)) {
        filter.state = state;
        return true;
      }
      return false;
    }
    case 'dashboard':
      filter.dashboardUid = value;
      return true;
    case 'panelId':
      filter.panelId = value;
      return true;
    case 'contactPoint':
      filter.contactPoint = value;
      return true;
    case 'policy':
      // The default tree's emitted name (`user-defined`) means the default policy, which no named-tree filter matches.
      filter.policy = isDefaultRoutingTreeName(value) ? DEFAULT_POLICY : value;
      return true;
    case 'paused': {
      const paused = value.toLowerCase();
      if (paused === 'true' || paused === 'false') {
        filter.paused = paused;
        return true;
      }
      return false;
    }
    case 'metric':
      filter.metric = value;
      return true;
    case 'targetDatasource':
      filter.targetDataSourceUid = value;
      return true;
  }
}

/** Returns undefined for a value with no label key, such as `=api` or `!`. */
function parseLabelValue(raw: string): SearchLabelMatcher | undefined {
  // A leading `!` not part of `!=`/`!~` means absence.
  if (raw[0] === '!' && raw[1] !== '=' && raw[1] !== '~') {
    const key = raw.slice(1);
    return key.length > 0 ? { key, operator: 'absent' } : undefined;
  }
  if (!/=|!~/.test(raw)) {
    return { key: raw, operator: 'exists' };
  }

  const matcher = attempt(() => parseMatcher(raw));
  if (isError(matcher)) {
    return undefined;
  }
  const { name: key, value, isRegex, isEqual } = matcher;
  // An empty value matches any value, so `team=` is `team`.
  if (value === '' && isEqual && !isRegex) {
    return { key, operator: 'exists' };
  }
  if (isRegex) {
    return { key, operator: isEqual ? 'regex' : 'notRegex', value };
  }
  return { key, operator: isEqual ? 'equal' : 'notEqual', value };
}

function isStateValue(value: string): value is StateValue {
  return Object.hasOwn(STATE_API_VALUES, value);
}

function isHealthValue(value: string): value is HealthValue {
  return value === 'ok' || Object.hasOwn(HEALTH_API_VALUES, value);
}

// Feedback

function getFeedback(filter: RuleSearchFilter, rejected: RejectedToken[], kind: RuleKind): FilterIssue[] {
  const issues: FilterIssue[] = rejected.map(({ key, renamed }) => {
    if (key === null) {
      return { key, reason: 'unclosedQuote' };
    }
    return renamed ? { key, reason: 'renamed', ...renamed } : { key, reason: 'invalid' };
  });

  const flagInvalidValue = (key: string) => issues.push({ key, reason: 'invalid' });

  // The title text search treats these as wildcards, which the rule search refuses.
  if (filter.text.some((word) => /[*%]/.test(word))) {
    issues.push({ key: null, reason: 'wildcardInText' });
  }
  if (filter.folders.some(hasWildcard)) {
    flagInvalidValue('folder');
  }
  if (filter.dataSourceUids.some((uid) => !isQueryDatasourceUid(uid))) {
    flagInvalidValue('datasource');
  }
  if (filter.labels.some(isRejectedLabel)) {
    flagInvalidValue('label');
  }

  if (kind === 'alert') {
    // Panel IDs are dashboard-local.
    if (filter.panelId && (!filter.dashboardUid || !isPositiveInteger(filter.panelId))) {
      flagInvalidValue('panelId');
    }
    if (filter.dashboardUid && hasWildcard(filter.dashboardUid)) {
      flagInvalidValue('dashboard');
    }
    if (filter.policy === DEFAULT_POLICY) {
      issues.push({ key: 'policy', reason: 'unavailable' });
    } else if (filter.policy && hasWildcard(filter.policy)) {
      flagInvalidValue('policy');
    }
    // A rule routes either through a policy or straight to a contact point, so the two never match together.
    if (filter.contactPoint && (filter.policy || hasWildcard(filter.contactPoint))) {
      flagInvalidValue('contactPoint');
    }
    // `paused In [false]` misses rules stored without a `paused` value until the backend indexes it as false.
    if (filter.paused === 'false') {
      issues.push({ key: 'paused', reason: 'unavailable' });
    }
  } else {
    if (filter.metric && hasWildcard(filter.metric)) {
      flagInvalidValue('metric');
    }
    if (filter.targetDataSourceUid && hasWildcard(filter.targetDataSourceUid)) {
      flagInvalidValue('targetDatasource');
    }
  }

  return issues;
}

function hasWildcard(value: string): boolean {
  return value.includes('*');
}

function isPositiveInteger(value: string): boolean {
  return /^\d+$/.test(value) && Number(value) > 0;
}

// Mimics the rule search's backend validation, which rejects these UIDs with a 400. Whether the data source
// exists isn't checked: an unknown UID matches no rules, like an unknown folder.
function isQueryDatasourceUid(uid: string): boolean {
  return DATASOURCE_UID_PATTERN.test(uid) && !EXPRESSION_DATASOURCE_UIDS.has(uid);
}

function isRejectedLabel({ key, operator, value }: SearchLabelMatcher): boolean {
  if (operator === 'regex' || operator === 'notRegex') {
    // Regex values are patterns, so a literal asterisk is meaningful there. The rule search validates the
    // pattern itself, and a pattern it refuses comes back as a rejection.
    return false;
  }
  const term = operator === 'equal' || operator === 'notEqual' ? `${key}=${value}` : key;
  // A leading "!" or an embedded "!=" would make the matcher's polarity ambiguous next to the operator.
  return hasWildcard(term) || term.startsWith('!') || term.includes('!=');
}

const DATASOURCE_UID_PATTERN = /^[a-zA-Z0-9_-]+$/;
// Expression nodes aren't data sources the backend indexes, so it rejects their UIDs.
const EXPRESSION_DATASOURCE_UIDS = new Set(['__expr__', '-100', '__ml__']);
