import { dateTimeAsMoment } from '@grafana/data';
import { contextSrv } from 'app/core/core';

import { Banner } from './Banner';
import { useBanner } from './hooks';

export function TopBanner() {
  const [banner] = useBanner();
  const { message, variant, enabled, endTime, startTime, visibility } = banner?.spec || {
    message: '',
    variant: 'info',
  };
  const { isSignedIn } = contextSrv.user;

  const isInDateRange = dateTimeAsMoment().isBetween(startTime, endTime, undefined, '[]');
  const userCanView = visibility === 'everyone' || (visibility === 'authenticated' && isSignedIn);

  if (!enabled || !isInDateRange || !userCanView) {
    return null;
  }

  return <Banner message={message} variant={variant} />;
}
