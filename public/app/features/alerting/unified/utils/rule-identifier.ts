/**
 * Taking rule identifiers apart and putting them back together. Nothing in here touches React,
 * the Redux store or any alerting API — the alerting route table imports this module while the
 * app is starting up, so anything it reaches lands in the first bundle the browser downloads.
 *
 * The rest of the identifier code lives in `rule-id.ts`, which re-exports everything here.
 */
import {
  type CloudRuleIdentifier,
  type PrometheusRuleIdentifier,
  type RuleIdentifier,
} from 'app/types/unified-alerting';

import { CLOUD_RULE_IDENTIFIER_PREFIX, PROMETHEUS_RULE_IDENTIFIER_PREFIX } from './constants';

/**
 * A Ruler identifier carries the hash of the rule as the Ruler API returned it. Kept here rather
 * than with the other rule type guards in `utils/rules.ts`, which reaches far too much to be
 * imported during startup. `utils/rules.ts` re-exports it.
 */
export function isCloudRuleIdentifier(identifier: RuleIdentifier): identifier is CloudRuleIdentifier {
  return 'rulerRuleHash' in identifier;
}

/** As above, for identifiers built from the Prometheus API rather than the Ruler one. */
export function isPrometheusRuleIdentifier(identifier: RuleIdentifier): identifier is PrometheusRuleIdentifier {
  return 'ruleHash' in identifier;
}

function escapeDollars(value: string): string {
  return value.replace(/\$/g, '_DOLLAR_');
}

function unescapeDollars(value: string): string {
  return value.replace(/\_DOLLAR\_/g, '$');
}

/**
 * deal with Unix-style path separators "/" (replaced with \x1f – unit separator)
 * and Windows-style path separators "\" (replaced with \x1e – record separator)
 * we need this to side-step proxies that automatically decode %2F to prevent path traversal attacks
 * we'll use some non-printable characters from the ASCII table that will get encoded properly but very unlikely
 * to ever be used in a rule name or namespace
 */
export function escapePathSeparators(value: string): string {
  return value.replace(/\//g, '\x1f').replace(/\\/g, '\x1e');
}

export function unescapePathSeparators(value: string): string {
  return value.replace(/\x1f/g, '/').replace(/\x1e/g, '\\');
}

export function parse(value: string, decodeFromUri = false): RuleIdentifier {
  const source = decodeFromUri ? decodeURIComponent(value) : value;
  const parts = source.split('$');

  if (parts.length === 1) {
    return { uid: value, ruleSourceName: 'grafana' };
  }

  if (parts.length === 6) {
    const [prefix, ruleSourceName, namespace, groupName, ruleName, hash] = parts
      .map(unescapeDollars)
      .map(unescapePathSeparators);

    if (prefix === CLOUD_RULE_IDENTIFIER_PREFIX) {
      return { ruleSourceName, namespace, groupName, ruleName, rulerRuleHash: hash };
    }

    if (prefix === PROMETHEUS_RULE_IDENTIFIER_PREFIX) {
      return { ruleSourceName, namespace, groupName, ruleName, ruleHash: hash };
    }
  }

  throw new Error(`Failed to parse rule location: ${value}`);
}

export function tryParse(value: string | undefined, decodeFromUri = false): RuleIdentifier | undefined {
  if (!value) {
    return;
  }

  try {
    return parse(value, decodeFromUri);
  } catch (error) {
    return;
  }
}

/** `decodeURIComponent`, but a stray '%' gives the raw value back instead of throwing. */
export function tryDecodeUriComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Takes an identifier straight out of a URL and hands it back only if it belongs to a data source
 * managed rule. Grafana-managed rules (a bare UID) and anything that won't parse give undefined.
 *
 * Everything that needs to know "is this rule data source managed, and what are its parts?" goes
 * through here, so the answer can't differ between the route matcher and the code that acts on it.
 */
export function parseDataSourceManagedIdentifier(
  identifier: string | undefined
): CloudRuleIdentifier | PrometheusRuleIdentifier | undefined {
  if (!identifier) {
    return undefined;
  }

  // Decoded out here rather than inside `parse`, so a stray '%' falls back to the raw value instead
  // of being read as "this doesn't parse". Rule names are allowed to contain one.
  const parsed = tryParse(tryDecodeUriComponent(identifier));
  if (!parsed || !(isCloudRuleIdentifier(parsed) || isPrometheusRuleIdentifier(parsed))) {
    return undefined;
  }

  return parsed;
}

/**
 * Grafana-managed rules are identified by a bare UID. Data source managed ones carry a prefix and
 * `$`-separated parts, so the identifier alone says who owns the rule without any lookup.
 *
 * This asks `parse` rather than just checking the prefix, so it only says yes to identifiers that
 * can actually be taken apart again. Anything that merely looks the part — `cri$` with the wrong
 * number of fields, say — is treated as not data source managed, which sends the page down the
 * ordinary Grafana route instead of making it wait on work that was always going to fail.
 */
export function isDataSourceManagedIdentifier(identifier: string | undefined): boolean {
  return parseDataSourceManagedIdentifier(identifier) !== undefined;
}

/**
 * Serialise a data source managed identifier, using `rulesSourceId` to say which rules source the
 * rule came from.
 *
 * Grafana's own URLs name the data source, which is what `stringifyIdentifier` gives you. The
 * grafana-prometheusalerting-app plugin puts the data source's UID in that same slot, so handing a
 * rule over to it means re-serialising with the UID instead.
 */
export function stringifyDataSourceIdentifier(
  identifier: CloudRuleIdentifier | PrometheusRuleIdentifier,
  rulesSourceId: string
): string {
  const [prefix, ruleHash] = isCloudRuleIdentifier(identifier)
    ? [CLOUD_RULE_IDENTIFIER_PREFIX, identifier.rulerRuleHash]
    : [PROMETHEUS_RULE_IDENTIFIER_PREFIX, identifier.ruleHash];

  return [prefix, rulesSourceId, identifier.namespace, identifier.groupName, identifier.ruleName, ruleHash]
    .map(String)
    .map(escapeDollars)
    .map(escapePathSeparators)
    .join('$');
}
