import { load } from 'js-yaml';

import { type MuteTimeInterval, type Receiver, type Route } from 'app/plugins/datasource/alertmanager/types';

import { normalizeMatchers } from '../../utils/matchers';

/**
 * The single staged Alertmanager configuration, as carried on `AlertManagerCortexConfig.extra_config[]`.
 * Declared locally because the shared `ExtraConfiguration` type doesn't (yet) model the config payload.
 */
export interface StagedExtraConfig {
  identifier: string;
  /** The imported Alertmanager configuration, as a YAML string. */
  alertmanager_config?: string;
  template_files?: Record<string, string>;
}

export function isStagedExtraConfig(value: unknown): value is StagedExtraConfig {
  return typeof value === 'object' && value !== null && 'identifier' in value;
}

/**
 * An inhibition rule supporting both the legacy `*_match`/`*_match_re` maps and the modern
 * Prometheus-style `*_matchers` lists. Declared locally so we don't extend the shared `InhibitRule`.
 */
interface StagedInhibitRule {
  source_match?: Record<string, string>;
  source_match_re?: Record<string, string>;
  source_matchers?: string[];
  target_match?: Record<string, string>;
  target_match_re?: Record<string, string>;
  target_matchers?: string[];
  equal?: string[];
}

/**
 * The parsed staged Alertmanager config. Mirrors the shared `AlertmanagerConfig` for the fields we read,
 * but uses the local {@link StagedInhibitRule} so we can surface `*_matchers` without touching shared types.
 */
export interface StagedAlertmanagerConfig {
  receivers?: Receiver[];
  route?: Route;
  templates?: string[];
  time_intervals?: MuteTimeInterval[];
  mute_time_intervals?: MuteTimeInterval[];
  inhibit_rules?: StagedInhibitRule[];
}

/** Pretty labels for the common Alertmanager `*_configs` integration keys. */
const INTEGRATION_LABELS: Record<string, string> = {
  pagerduty: 'PagerDuty',
  slack: 'Slack',
  email: 'Email',
  webhook: 'Webhook',
  opsgenie: 'Opsgenie',
  victorops: 'VictorOps',
  pushover: 'Pushover',
  wechat: 'WeChat',
  webex: 'Webex',
  discord: 'Discord',
  telegram: 'Telegram',
  sns: 'SNS',
  msteams: 'Microsoft Teams',
};

const CONFIGS_SUFFIX = '_configs';

export interface StagedConfigSummary {
  /** Contact point (receiver) names, kept in configuration order — Alertmanager contact points are not alphabetised. */
  receivers: string[];
  hasRoutingTree: boolean;
  templates: string[];
  timeIntervals: string[];
  inhibitionRuleCount: number;
}

/**
 * Parse the imported Alertmanager configuration (a YAML string carried on the staged config).
 * Returns undefined when the input is empty or cannot be parsed into an object.
 */
function isStagedAlertmanagerConfig(value: unknown): value is StagedAlertmanagerConfig {
  return typeof value === 'object' && value !== null;
}

export function parseStagedAlertmanagerConfig(yamlConfig: string | undefined): StagedAlertmanagerConfig | undefined {
  if (!yamlConfig) {
    return undefined;
  }

  try {
    const parsed = load(yamlConfig);
    return isStagedAlertmanagerConfig(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function summarizeStagedConfig(
  config: StagedAlertmanagerConfig,
  templateFiles?: Record<string, string>
): StagedConfigSummary {
  const receivers = (config.receivers ?? []).map((receiver) => receiver.name);
  const timeIntervals = [...(config.time_intervals ?? []), ...(config.mute_time_intervals ?? [])].map(
    (interval) => interval.name
  );
  // Grafana template groups are the imported `template_files` entries; the AM config's `templates`
  // field is only a list of file globs, so prefer the file names and fall back to the globs.
  const templateFileNames = Object.keys(templateFiles ?? {});
  const templates = templateFileNames.length > 0 ? templateFileNames : (config.templates ?? []);

  return {
    receivers,
    hasRoutingTree: Boolean(config.route),
    templates,
    timeIntervals,
    inhibitionRuleCount: (config.inhibit_rules ?? []).length,
  };
}

/** Integration types configured on a receiver, derived from its `*_configs` keys (e.g. "PagerDuty", "Slack"). */
export function getReceiverIntegrationTypes(receiver: Receiver): string[] {
  return Object.keys(receiver)
    .filter((key) => key.endsWith(CONFIGS_SUFFIX))
    .map((key) => {
      const base = key.slice(0, -CONFIGS_SUFFIX.length);
      return INTEGRATION_LABELS[base] ?? base;
    });
}

/**
 * Render one side of an inhibition rule as a compact, human-readable matcher string. Supports both the
 * legacy `*_match`/`*_match_re` maps and the modern Prometheus-style `*_matchers` list.
 */
export function summarizeMatchRecord(
  match?: Record<string, string>,
  matchRe?: Record<string, string>,
  matchers?: string[]
): string {
  const exact = Object.entries(match ?? {}).map(([name, value]) => `${name}=${value}`);
  const regex = Object.entries(matchRe ?? {}).map(([name, value]) => `${name}=~${value}`);
  return [...exact, ...regex, ...(matchers ?? [])].join(', ');
}

/**
 * Human-readable matcher summary for a route. Reuses {@link normalizeMatchers} so every matcher
 * representation (matchers, object_matchers, match, match_re) is covered; returns '' on malformed input.
 */
export function summarizeRouteMatchers(route: Route): string {
  try {
    return normalizeMatchers(route)
      .map(([name, operator, value]) => `${name}${operator}${value}`)
      .join(', ');
  } catch {
    return '';
  }
}
