import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SETUPGUIDE_PLUGIN_ID } from 'app/core/constants';
import { contextSrv } from 'app/core/services/context_srv';

import { type SolutionCta, type SolutionLearnMore } from './types';

export type TelemetryType = 'metrics' | 'logs' | 'traces';

interface TelemetrySetupCapabilities {
  setupGuideEnabled: boolean;
}

export interface TelemetrySetupLink {
  action: string;
  href: string;
  cta: 'setup' | 'learn_more';
}

export const TELEMETRY_SETUP_DOCS = {
  metrics: 'https://grafana.com/docs/grafana/latest/datasources/prometheus/configure/',
  logs: 'https://grafana.com/docs/loki/latest/send-data/',
  traces: 'https://grafana.com/docs/tempo/latest/set-up-for-tracing/',
} satisfies Record<TelemetryType, string>;

const GRAFANA_CLOUD_DOCS_BASE_URL = 'https://grafana.com/docs/grafana-cloud';

const setup: Record<
  TelemetryType,
  { action: () => string; guidePath?: string; cloudDocsHref: string; docsHref: string }
> = {
  metrics: {
    action: () => t('home.overview.available.metrics.action', 'Connect metrics'),
    guidePath: `/a/${SETUPGUIDE_PLUGIN_ID}/getting-started/prometheus`,
    cloudDocsHref: `${GRAFANA_CLOUD_DOCS_BASE_URL}/send-data/metrics/`,
    docsHref: TELEMETRY_SETUP_DOCS.metrics,
  },
  logs: {
    action: () => t('home.overview.available.logs.action', 'Add logs'),
    guidePath: `/a/${SETUPGUIDE_PLUGIN_ID}/getting-started/logs-onboarding`,
    cloudDocsHref: `${GRAFANA_CLOUD_DOCS_BASE_URL}/send-data/logs/`,
    docsHref: TELEMETRY_SETUP_DOCS.logs,
  },
  traces: {
    action: () => t('home.overview.available.traces.action', 'Instrument traces'),
    cloudDocsHref: `${GRAFANA_CLOUD_DOCS_BASE_URL}/send-data/traces/set-up/instrument-apps/`,
    docsHref: TELEMETRY_SETUP_DOCS.traces,
  },
};

/** Prefer an accessible in-app guide; otherwise send the user to the matching docs. */
export function getTelemetrySetupLink(
  type: TelemetryType,
  capabilities: TelemetrySetupCapabilities
): TelemetrySetupLink {
  const definition = setup[type];
  const cta = getTelemetrySetupCta(type, capabilities);
  if (cta) {
    return { action: cta.label, href: cta.href, cta: cta.action };
  }

  return {
    action: definition.action(),
    href: getTelemetrySetupLearnMore(type, capabilities).href,
    cta: 'learn_more',
  };
}

export function getTelemetrySetupCta(
  type: TelemetryType,
  capabilities: TelemetrySetupCapabilities
): SolutionCta<'setup'> | null {
  const definition = setup[type];
  if (
    !definition.guidePath ||
    !capabilities.setupGuideEnabled ||
    (!contextSrv.hasRole('Admin') && !contextSrv.isGrafanaAdmin)
  ) {
    return null;
  }
  return { label: definition.action(), href: locationUtil.assureBaseUrl(definition.guidePath), action: 'setup' };
}

export function getTelemetrySetupLearnMore(
  type: TelemetryType,
  capabilities: TelemetrySetupCapabilities
): SolutionLearnMore {
  const definition = setup[type];
  return { href: capabilities.setupGuideEnabled ? definition.cloudDocsHref : definition.docsHref };
}
