import { useCallback, useMemo } from 'react';
import { useAsync } from 'react-use';

import { type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { isAppPluginEnabled } from '@grafana/runtime';
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
 * Returns a getter for attribute promos whose plugins are not installed or not activated.
 * Adding a promo only requires a new entry in {@link getAttributePluginPromos}.
 * Returns no promo while status is loading or unavailable, to avoid a flash for activated plugins.
 * Installed status comes from bootdata metas (no request); enabled is only fetched for installed apps
 * to avoid 404s for plugins that aren't present.
 */
export function useAttributePluginPromoGetter(): AttributePluginPromoGetter {
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

  return useCallback(
    (attributeKey: string) => {
      if (!inactivePluginIds) {
        return undefined;
      }
      return promos.find((promo) => inactivePluginIds.has(promo.pluginId) && promo.match(attributeKey));
    },
    [inactivePluginIds, promos]
  );
}
