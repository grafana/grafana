import { nth } from 'lodash';

import { locationService } from '@grafana/runtime';
import {
  CloudRuleIdentifier,
  CombinedRule,
  EditableRuleIdentifier,
  Rule,
  RuleGroupIdentifier,
  RuleIdentifier,
  RuleWithLocation,
} from 'app/types/unified-alerting';
import { Annotations, Labels, RulerRuleDTO } from 'app/types/unified-alerting-dto';

import { GRAFANA_RULES_SOURCE_NAME } from './datasource';
import {
  isAlertingRule,
  isAlertingRulerRule,
  isCloudRuleIdentifier,
  isGrafanaRuleIdentifier,
  isGrafanaRulerRule,
  isPrometheusRuleIdentifier,
  isRecordingRule,
  isRecordingRulerRule,
} from './rules';

export function fromRulerRule(
  ruleSourceName: string,
  namespace: string,
  groupName: string,
  rule: RulerRuleDTO
): EditableRuleIdentifier {
  if (isGrafanaRulerRule(rule)) {
    return { uid: rule.grafana_alert.uid!, ruleSourceName: 'grafana' };
  }
  return {
    ruleSourceName,
    namespace,
    groupName,
    ruleName: isAlertingRulerRule(rule) ? rule.alert : rule.record,
    rulerRuleHash: hashRulerRule(rule),
  } satisfies CloudRuleIdentifier;
}

export function fromRulerRuleAndRuleGroupIdentifier(
  ruleGroup: RuleGroupIdentifier,
  rule: RulerRuleDTO
): EditableRuleIdentifier {
  const { dataSourceName, namespaceName, groupName } = ruleGroup;
  return fromRulerRule(dataSourceName, namespaceName, groupName, rule);
}

export function fromRule(ruleSourceName: string, namespace: string, groupName: string, rule: Rule): RuleIdentifier {
  return {
    ruleSourceName,
    namespace,
    groupName,
    ruleName: rule.name,
    ruleHash: hashRule(rule),
  };
}

export function fromCombinedRule(ruleSourceName: string, rule: CombinedRule): RuleIdentifier {
  const namespaceName = rule.namespace.name;
  const groupName = rule.group.name;

  if (rule.rulerRule) {
    return fromRulerRule(ruleSourceName, namespaceName, groupName, rule.rulerRule);
  }

  if (rule.promRule) {
    return fromRule(ruleSourceName, namespaceName, groupName, rule.promRule);
  }

  throw new Error('Could not create an id for a rule that is missing both `rulerRule` and `promRule`.');
}

export function fromRuleWithLocation(rule: RuleWithLocation): RuleIdentifier {
  return fromRulerRule(rule.ruleSourceName, rule.namespace, rule.group.name, rule.rule);
}

export function equal(a: RuleIdentifier, b: RuleIdentifier) {
  if (isGrafanaRuleIdentifier(a) && isGrafanaRuleIdentifier(b)) {
    return a.uid === b.uid;
  }

  if (isCloudRuleIdentifier(a) && isCloudRuleIdentifier(b)) {
    return (
      a.groupName === b.groupName &&
      a.namespace === b.namespace &&
      a.ruleName === b.ruleName &&
      a.rulerRuleHash === b.rulerRuleHash &&
      a.ruleSourceName === b.ruleSourceName
    );
  }

  if (isPrometheusRuleIdentifier(a) && isPrometheusRuleIdentifier(b)) {
    return (
      a.groupName === b.groupName &&
      a.namespace === b.namespace &&
      a.ruleName === b.ruleName &&
      a.ruleHash === b.ruleHash &&
      a.ruleSourceName === b.ruleSourceName
    );
  }

  return false;
}

const cloudRuleIdentifierPrefix = 'cri';
const prometheusRuleIdentifierPrefix = 'pri';

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

    if (prefix === cloudRuleIdentifierPrefix) {
      return { ruleSourceName, namespace, groupName, ruleName, rulerRuleHash: hash };
    }

    if (prefix === prometheusRuleIdentifierPrefix) {
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

export function stringifyIdentifier(identifier: RuleIdentifier): string {
  if (isGrafanaRuleIdentifier(identifier)) {
    return identifier.uid;
  }

  if (isCloudRuleIdentifier(identifier)) {
    return [
      cloudRuleIdentifierPrefix,
      identifier.ruleSourceName,
      identifier.namespace,
      identifier.groupName,
      identifier.ruleName,
      identifier.rulerRuleHash,
    ]
      .map(String)
      .map(escapeDollars)
      .map(escapePathSeparators)
      .join('$');
  }

  return [
    prometheusRuleIdentifierPrefix,
    identifier.ruleSourceName,
    identifier.namespace,
    identifier.groupName,
    identifier.ruleName,
    identifier.ruleHash,
  ]
    .map(String)
    .map(escapeDollars)
    .map(escapePathSeparators)
    .join('$');
}

function hash(value: string): number {
  let hash = 0;
  if (value.length === 0) {
    return hash;
  }
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

// this is used to identify rules, mimir / loki rules do not have a unique identifier
export function hashRulerRule(rule: RulerRuleDTO): string {
  if (isRecordingRulerRule(rule)) {
    return hash(JSON.stringify([rule.record, rule.expr, hashLabelsOrAnnotations(rule.labels)])).toString();
  } else if (isAlertingRulerRule(rule)) {
    return hash(
      JSON.stringify([
        rule.alert,
        rule.expr,
        hashLabelsOrAnnotations(rule.annotations),
        hashLabelsOrAnnotations(rule.labels),
      ])
    ).toString();
  } else if (isGrafanaRulerRule(rule)) {
    return rule.grafana_alert.uid;
  } else {
    throw new Error('only recording and alerting ruler rules can be hashed');
  }
}

export function hashRule(rule: Rule): string {
  if (isRecordingRule(rule)) {
    return hash(JSON.stringify([rule.type, rule.query, hashLabelsOrAnnotations(rule.labels)])).toString();
  }

  if (isAlertingRule(rule)) {
    return hash(
      JSON.stringify([
        rule.type,
        rule.query,
        hashLabelsOrAnnotations(rule.annotations),
        hashLabelsOrAnnotations(rule.labels),
      ])
    ).toString();
  }

  throw new Error('only recording and alerting rules can be hashed');
}

export function hashLabelsOrAnnotations(item: Labels | Annotations | undefined): string {
  return JSON.stringify(Object.entries(item || {}).sort((a, b) => a[0].localeCompare(b[0])));
}

export function ruleIdentifierToRuleSourceName(identifier: RuleIdentifier): string {
  return isGrafanaRuleIdentifier(identifier) ? GRAFANA_RULES_SOURCE_NAME : identifier.ruleSourceName;
}

// DO NOT USE REACT-ROUTER HOOKS FOR THIS CODE
// React-router's useLocation/useParams/props.match are broken and don't preserve original param values when parsing location
// so, they cannot be used to parse name and sourceName path params
// React-router messes the pathname up resulting in a string that is neither encoded nor decoded
// Relevant issue: https://github.com/remix-run/history/issues/505#issuecomment-453175833
// It was probably fixed in React-Router v6
type PathWithOptionalID = { id?: string };
export function getRuleIdFromPathname(params: PathWithOptionalID): string | undefined {
  const { pathname = '' } = locationService.getLocation();
  const { id } = params;

  return id ? nth(pathname.split('/'), -2) : undefined;
}
