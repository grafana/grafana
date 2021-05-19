import {
  AlertManagerCortexConfig,
  MatcherOperator,
  Route,
  SilenceMatcher,
} from 'app/plugins/datasource/alertmanager/types';

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

export function matcherToOperator(matcher: SilenceMatcher): MatcherOperator {
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
