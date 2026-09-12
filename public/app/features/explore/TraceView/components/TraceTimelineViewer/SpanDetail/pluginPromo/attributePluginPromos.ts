import { useCallback, useMemo } from 'react';
import { useAsync } from 'react-use';

import { type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { isAppPluginEnabled } from '@grafana/runtime';
import { useAppPluginMetas } from '@grafana/runtime/internal';
import { isOnPrem } from 'app/core/utils/isOnPrem';

import {
  isDatabaseAttribute,
  isFrontendObservabilityAttribute,
  isKnowledgeGraphAttribute,
  isKubernetesAttribute,
  isServiceAttribute,
} from '../attributeCategories';

export type AttributePluginPromo = {
  pluginId: string;
  icon: IconName;
  title: string;
  body: string;
  match: (attributeKey: string) => boolean;
};

/** Cap how many attribute rows can show a promo tip in one span detail view. */
export const MAX_ATTRIBUTE_PLUGIN_PROMOS = 3;

/**
 * Promos shown on attribute values when the related app plugin is not installed,
 * or is installed but not activated (enabled).
 * Add new entries here as other apps (Knowledge Graph, App O11y, etc.) adopt this pattern.
 * Cloud-only: never shown on on-prem OSS or Enterprise (`isOnPrem()`).
 */
export function getAttributePluginPromos(): AttributePluginPromo[] {
  if (isOnPrem()) {
    return [];
  }

  return [
    {
      pluginId: 'grafana-asserts-app',
      icon: 'asserts',
      title: t('explore.trace-view.knowledge-graph-promo.title', 'See the full picture'),
      body: t(
        'explore.trace-view.knowledge-graph-promo.body',
        'Knowledge Graph correlates services, infrastructure, and insights from your traces — helping you navigate from a span attribute to related entities and assertions.'
      ),
      match: isKnowledgeGraphAttribute,
    },
    {
      pluginId: 'grafana-dbo11y-app',
      icon: 'database-observability',
      title: t('explore.trace-view.database-observability-promo.title', 'Find slow queries faster'),
      body: t(
        'explore.trace-view.database-observability-promo.body',
        'Database Observability surfaces visual explain plans, wait events, and query samples — helping you diagnose issues beyond trace spans.'
      ),
      match: isDatabaseAttribute,
    },
    {
      pluginId: 'grafana-kowalski-app',
      icon: 'frontend-observability',
      title: t('explore.trace-view.frontend-observability-promo.title', 'Debug real user sessions'),
      body: t(
        'explore.trace-view.frontend-observability-promo.body',
        'Frontend Observability links trace attributes to sessions, errors, and performance — so you can see what users experienced when a span ran.'
      ),
      match: isFrontendObservabilityAttribute,
    },
    {
      pluginId: 'grafana-app-observability-app',
      icon: 'application-observability',
      title: t('explore.trace-view.application-observability-promo.title', 'Understand your services faster'),
      body: t(
        'explore.trace-view.application-observability-promo.body',
        'Application Observability connects traces, metrics, and logs for each service — so you can spot regressions and drill into root cause.'
      ),
      match: isServiceAttribute,
    },
    {
      pluginId: 'grafana-k8s-app',
      icon: 'kubernetes',
      title: t('explore.trace-view.kubernetes-promo.title', 'Drill into your cluster'),
      body: t(
        'explore.trace-view.kubernetes-promo.body',
        'Kubernetes Monitoring turns trace attributes into navigation to clusters, namespaces, workloads, and pods — with metrics and health context in one place.'
      ),
      match: isKubernetesAttribute,
    },
  ];
}

/**
 * Picks up to {@link MAX_ATTRIBUTE_PLUGIN_PROMOS} attribute keys to promote.
 * Walks promos in priority order and assigns at most one key per inactive plugin
 * so a span with many matching attrs does not become a wall of promo tips.
 * Returns the promo that claimed each key so overlapping matchers (e.g. service.*)
 * keep their assignment instead of collapsing to the first matching promo.
 */
export function selectAttributeKeysForPromos(
  attributeKeys: readonly string[],
  inactivePluginIds: ReadonlySet<string>,
  promos: readonly AttributePluginPromo[],
  maxPromos = MAX_ATTRIBUTE_PLUGIN_PROMOS
): Map<string, AttributePluginPromo> {
  const selectedPromos = new Map<string, AttributePluginPromo>();

  for (const promo of promos) {
    if (selectedPromos.size >= maxPromos) {
      break;
    }
    if (!inactivePluginIds.has(promo.pluginId)) {
      continue;
    }

    const matchingKey = attributeKeys.find((key) => !selectedPromos.has(key) && promo.match(key));
    if (matchingKey) {
      selectedPromos.set(matchingKey, promo);
    }
  }

  return selectedPromos;
}

export type AttributePluginPromoGetter = (attributeKey: string) => AttributePluginPromo | undefined;

/**
 * Returns a getter for attribute promos whose plugins are not installed or not activated.
 * Adding a promo only requires a new entry in {@link getAttributePluginPromos}.
 * Returns no promo while status is loading or unavailable, to avoid a flash for activated plugins.
 * Installed status comes from bootdata metas (no request); enabled is only fetched for installed apps
 * to avoid 404s for plugins that aren't present.
 * At most {@link MAX_ATTRIBUTE_PLUGIN_PROMOS} attribute keys from {@link attributeKeys} get a promo.
 */
export function useAttributePluginPromoGetter(attributeKeys: readonly string[] = []): AttributePluginPromoGetter {
  const promos = useMemo(() => getAttributePluginPromos(), []);
  const { loading: metasLoading, value: appMetas } = useAppPluginMetas();

  const { value: inactivePluginIds } = useAsync(async () => {
    if (metasLoading || appMetas === undefined) {
      return undefined;
    }

    const installedPluginIds = new Set(appMetas.map((app) => app.id));
    const inactive = new Set<string>();

    await Promise.all(
      promos.map(async ({ pluginId }) => {
        if (!installedPluginIds.has(pluginId)) {
          inactive.add(pluginId);
          return;
        }
        if (!(await isAppPluginEnabled(pluginId))) {
          inactive.add(pluginId);
        }
      })
    );

    return inactive;
  }, [appMetas, metasLoading, promos]);

  const promosByAttributeKey = useMemo(() => {
    if (!inactivePluginIds) {
      return undefined;
    }
    return selectAttributeKeysForPromos(attributeKeys, inactivePluginIds, promos);
  }, [attributeKeys, inactivePluginIds, promos]);

  return useCallback((attributeKey: string) => promosByAttributeKey?.get(attributeKey), [promosByAttributeKey]);
}
