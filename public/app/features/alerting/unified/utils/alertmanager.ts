import { AlertManagerCortexConfig, MatcherOperator, Route, Matcher } from 'app/plugins/datasource/alertmanager/types';
import { Labels } from 'app/types/unified-alerting-dto';

export function addDefaultsToAlertmanagerConfig(config: AlertManagerCortexConfig): AlertManagerCortexConfig {
  // add default receiver if it does not exist
  if (!config.alertmanager_config.receivers) {
    config.alertmanager_config.receivers = [{ name: 'default ' }];
  }
  // add default route if it does not exists
  if (!config.alertmanager_config.route) {
    config.alertmanager_config.route = {
      receiver: config.alertmanager_config.receivers![0].name,
    };
  }
  if (!config.template_files) {
    config.template_files = {};
  }
  return config;
}

function isReceiverUsedInRoute(receiver: string, route: Route): boolean {
  return (
    (route.receiver === receiver || route.routes?.some((route) => isReceiverUsedInRoute(receiver, route))) ?? false
  );
}

export function isReceiverUsed(receiver: string, config: AlertManagerCortexConfig): boolean {
  return (
    (config.alertmanager_config.route && isReceiverUsedInRoute(receiver, config.alertmanager_config.route)) ?? false
  );
}

export function matcherToOperator(matcher: Matcher): MatcherOperator {
  if (matcher.isEqual) {
    if (matcher.isRegex) {
      return MatcherOperator.regex;
    } else {
      return MatcherOperator.equal;
    }
  } else if (matcher.isRegex) {
    return MatcherOperator.notRegex;
  } else {
    return MatcherOperator.notEqual;
  }
}

const matcherOperators = [
  MatcherOperator.regex,
  MatcherOperator.notRegex,
  MatcherOperator.notEqual,
  MatcherOperator.equal,
];

function unescapeMatcherValue(value: string) {
  let trimmed = value.trim().replace(/\\"/g, '"');
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && !trimmed.endsWith('\\"')) {
    trimmed = trimmed.substr(1, trimmed.length - 2);
  }
  return trimmed.replace(/\\"/g, '"');
}

function escapeMatcherValue(value: string) {
  return '"' + value.replace(/"/g, '\\"') + '"';
}

export function stringifyMatcher(matcher: Matcher): string {
  return `${matcher.name}${matcherToOperator(matcher)}${escapeMatcherValue(matcher.value)}`;
}

export function parseMatcher(matcher: string): Matcher {
  const trimmed = matcher.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    throw new Error(`PromQL matchers not supported yet, sorry! PromQL matcher found: ${trimmed}`);
  }
  const operatorsFound = matcherOperators
    .map((op): [MatcherOperator, number] => [op, trimmed.indexOf(op)])
    .filter(([_, idx]) => idx > -1)
    .sort((a, b) => a[1] - b[1]);

  if (!operatorsFound.length) {
    throw new Error(`Invalid matcher: ${trimmed}`);
  }
  const [operator, idx] = operatorsFound[0];
  const name = trimmed.substr(0, idx).trim();
  const value = unescapeMatcherValue(trimmed.substr(idx + operator.length).trim());
  if (!name) {
    throw new Error(`Invalid matcher: ${trimmed}`);
  }

  return {
    name,
    value,
    isRegex: operator === MatcherOperator.regex || operator === MatcherOperator.notRegex,
    isEqual: operator === MatcherOperator.equal || operator === MatcherOperator.regex,
  };
}

export function parseMatchers(matcherQueryString: string): Matcher[] {
  const matcherRegExp = /\b(\w+)(=~|!=|!~|=(?="?\w))"?([^"\n,]*)"?/g;
  const matchers: Matcher[] = [];

  matcherQueryString.replace(matcherRegExp, (_, key, operator, value) => {
    const isEqual = operator === MatcherOperator.equal || operator === MatcherOperator.regex;
    const isRegex = operator === MatcherOperator.regex || operator === MatcherOperator.notRegex;
    matchers.push({
      name: key,
      value,
      isEqual,
      isRegex,
    });
    return '';
  });

  return matchers;
}

export function labelsMatchMatchers(labels: Labels, matchers: Matcher[]): boolean {
  return matchers.every(({ name, value, isRegex, isEqual }) => {
    return Object.entries(labels).some(([labelKey, labelValue]) => {
      const nameMatches = name === labelKey;
      let valueMatches;
      if (isEqual && !isRegex) {
        valueMatches = value === labelValue;
      }
      if (!isEqual && !isRegex) {
        valueMatches = value !== labelValue;
      }
      if (isEqual && isRegex) {
        valueMatches = new RegExp(value).test(labelValue);
      }
      if (!isEqual && isRegex) {
        valueMatches = !new RegExp(value).test(labelValue);
      }

      return nameMatches && valueMatches;
    });
  });
}
