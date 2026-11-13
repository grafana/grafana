import { lazy, Suspense, useEffect } from 'react';

import { useMergedPreferencesQuery } from '@grafana/api-clients/rtkq/preferences/v1';
import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { PageLoader } from '@grafana/ui';
import { markAsUrlRewrite } from 'app/core/navigation/urlRewrite';

import { type DashboardPageProxyProps } from '../dashboard/containers/DashboardPageProxy';

import { HomePagePicker } from './HomePagePicker';
import { HomePageView } from './HomePageView';
import { getHomePageRef } from './homePageRef';
import { useHomePageChoice } from './useHomePageChoice';

const DashboardPageProxy = lazy(
  () => import(/* webpackChunkName: "DashboardPageProxy" */ '../dashboard/containers/DashboardPageProxy')
);
const HomePage = lazy(() => import(/* webpackChunkName: "HomePage" */ './HomePage'));

function HomeRouteInner(props: DashboardPageProxyProps) {
  const { data, isLoading } = useMergedPreferencesQuery();
  // The user picked this page on the homepage itself, so it beats every inherited home setting
  const { pageId: chosenPageId } = useHomePageChoice();
  const isChoiceLoading = chosenPageId === undefined;
  const redirectUri = data?.spec?.homeURL;
  const homeDashboardUID = data?.spec?.homeDashboardUID;
  // homeDashboardUID takes precedence over homeURL
  const configuredPageRef = homeDashboardUID ? undefined : getHomePageRef(redirectUri);
  // A Grafana Page renders in place, so home stays at `/` instead of redirecting to the page
  const willRedirect = !!redirectUri && !homeDashboardUID && !configuredPageRef && !chosenPageId;

  useEffect(() => {
    if (!willRedirect || isChoiceLoading) {
      return;
    }
    const newUrl = locationUtil.processRedirectUri(redirectUri, locationService.getLocation());
    // Landing-page resolution, not a navigation: journey trackers keep previousUrl absent.
    locationService.replace(markAsUrlRewrite(newUrl));
  }, [willRedirect, isChoiceLoading, redirectUri]);

  if (isLoading || isChoiceLoading || willRedirect) {
    return <PageLoader />;
  }

  if (chosenPageId) {
    return <HomePageView pageId={chosenPageId} />;
  }

  // Prefer a known home dashboard UID (including cached data after a failed refetch)
  // over the error fallback so a transient prefs failure does not replace a configured home.
  if (homeDashboardUID) {
    return <DashboardPageProxy {...props} />;
  }

  if (configuredPageRef) {
    return <HomePageView pageId={configuredPageRef} />;
  }

  // Empty/absent UID, or prefs probe failed with no UID available → unified homepage
  return <HomePage actions={<HomePagePicker />} />;
}

export default function HomeRoute(props: DashboardPageProxyProps) {
  return (
    <Suspense fallback={<PageLoader />}>
      <HomeRouteInner {...props} />
    </Suspense>
  );
}
