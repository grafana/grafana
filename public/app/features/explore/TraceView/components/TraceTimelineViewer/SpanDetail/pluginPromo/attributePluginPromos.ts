import { useCallback, useMemo } from 'react';

import { type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useAppPluginMetas } from '@grafana/runtime/internal';
import { isOnPrem } from 'app/core/utils/isOnPrem';

import { isDatabaseAttribute } from '../attributeCategories';

export type AttributePluginPromo = {
  pluginId: string;
  icon: IconName;
  title: string;
  body: string;
  match: (attributeKey: string) => boolean;
};

/**
 * Promos shown on attribute values when the related app plugin is not installed.
 * Add new entries here as other apps (Knowledge Graph, App O11y, etc.) adopt this pattern.
 * Cloud-only: never shown on on-prem OSS or Enterprise (`isOnPrem()`).
 */
export function getAttributePluginPromos(): AttributePluginPromo[] {
  if (isOnPrem()) {
    return [];
  }

  return [
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
  ];
}

export type AttributePluginPromoGetter = (attributeKey: string) => AttributePluginPromo | undefined;

/**
 * Returns a getter for attribute promos whose plugins are not installed.
 * Adding a promo only requires a new entry in {@link getAttributePluginPromos}.
 * Returns no promo while plugin metas are loading or unavailable, to avoid a flash for installed plugins.
 */
export function useAttributePluginPromoGetter(): AttributePluginPromoGetter {
  const promos = useMemo(() => getAttributePluginPromos(), []);
  const { loading, value: appMetas } = useAppPluginMetas();

  const installedPluginIds = useMemo(() => {
    if (loading || appMetas === undefined) {
      return undefined;
    }
    return new Set(appMetas.map((app) => app.id));
  }, [appMetas, loading]);

  return useCallback(
    (attributeKey: string) => {
      if (!installedPluginIds) {
        return undefined;
      }
      return promos.find((promo) => !installedPluginIds.has(promo.pluginId) && promo.match(attributeKey));
    },
    [installedPluginIds, promos]
  );
}
