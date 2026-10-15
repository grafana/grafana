import { type JSX, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { t } from '@grafana/i18n';
import { LoadingPlaceholder } from '@grafana/ui';

import { migrateLegacyRuleListUrl } from './legacyUrlMigration';
import { legacyRuleListNameResolvers } from './nameResolvers';
import { useDroppedFiltersWarning } from './useDroppedFiltersWarning';

/** Unmigratable filters are dropped and reported by name, never by value. */
export function LegacyRuleListRedirect(): JSX.Element {
  const location = useLocation();
  const warnAboutDroppedFilters = useDroppedFiltersWarning();

  const { value: destination } = useAsync(
    () => migrateLegacyRuleListUrl(location, legacyRuleListNameResolvers),
    [location]
  );

  const droppedKeys = destination?.diagnostics.droppedKeys;
  useEffect(() => {
    if (droppedKeys) {
      warnAboutDroppedFilters(droppedKeys);
    }
  }, [droppedKeys, warnAboutDroppedFilters]);

  if (!destination) {
    return <LoadingPlaceholder text={t('alerting.gma-rule-list.migrating-link', 'Redirecting...')} />;
  }

  return <Navigate replace to={`${destination.pathname}${destination.search}`} />;
}

/** Each rule type has its own trash, so this lands on Alert rules'. The old page took no filters. */
export function LegacyRecentlyDeletedRedirect(): JSX.Element {
  const location = useLocation();

  return <Navigate replace to={`/alerting/rules/alert/deleted${location.search}`} />;
}
