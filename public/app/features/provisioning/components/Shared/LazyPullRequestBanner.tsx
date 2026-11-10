import { Suspense, lazy } from 'react';

import { usePullRequestParam } from '../../hooks/usePullRequestParam';

const PullRequestBannerFromUrl = lazy(() =>
  import('./PullRequestBannerFromUrl').then((module) => ({ default: module.PullRequestBannerFromUrl }))
);

export const LazyPullRequestBanner = () => {
  const { prURL, newPrURL } = usePullRequestParam();
  if (!prURL && !newPrURL) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <PullRequestBannerFromUrl />
    </Suspense>
  );
};
