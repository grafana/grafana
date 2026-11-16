import { Suspense, lazy } from 'react';

import { useFeatureControlContext } from './FeatureControlProvider';

const FeatureControlButton = lazy(() =>
  import('./FeatureControlButton').then((module) => ({ default: module.FeatureControlButton }))
);

const FeatureControlFloating = lazy(() =>
  import('./FeatureControlFloating').then((module) => ({ default: module.FeatureControlFloating }))
);

/*
 * Feature control is a developer tool that almost nobody has switched on, so all of it — the
 * button, the panel, the animated flask — is kept out of the main bundle. Only this module and
 * FeatureControlProvider are loaded up front.
 *
 * These components own the `isAccessible`/`isOpen` checks rather than the components they wrap:
 * rendering a lazy component is what triggers its chunk to download, so a component that
 * fetched its own code only to return null would download it for everybody.
 */

export const LazyFeatureControlButton = () => {
  const { isAccessible } = useFeatureControlContext();

  if (!isAccessible) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <FeatureControlButton />
    </Suspense>
  );
};

export const LazyFeatureControlFloating = () => {
  const { isOpen } = useFeatureControlContext();

  if (!isOpen) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <FeatureControlFloating />
    </Suspense>
  );
};
