import { type JSX, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { t } from '@grafana/i18n';
import { LoadingPlaceholder } from '@grafana/ui';

import { migrateLegacyRuleListUrl } from './legacyUrlMigration';
import { legacyRuleListNameResolvers } from './nameResolvers';
import { useDroppedFiltersWarning } from './useDroppedFiltersWarning';

/**
 * Redirect for the legacy combined rule list, active only while `alerting.gmaOnlyListView` is
 * on. Runs the full query migration (type-based destination choice, legacy-param translation,
 * and folder/data-source name resolution) before navigating, so a resolvable legacy link lands
 * on an equivalent canonical URL rather than an unfiltered one. The redirect always completes:
 * a filter that cannot be migrated is removed and named in a warning, never its value.
 */
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

/**
 * Redirect for the legacy combined Recently deleted page, active only while
 * `alerting.gmaOnlyListView` is on. Always lands on Alert rules' Recently deleted tab; deleted
 * Recording rules are reachable only from Recording rules' own Recently deleted tab, since each
 * rule type keeps its own trash rather than sharing a combined one. No query migration runs here
 * because the combined trash page never accepted filter parameters.
 */
export function LegacyRecentlyDeletedRedirect(): JSX.Element {
  const location = useLocation();

  return <Navigate replace to={`/alerting/rules/alert/deleted${location.search}`} />;
}
