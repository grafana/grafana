import { locationService } from '@grafana/runtime';
import { addPageBanner } from 'app/AppWrapper';
import { contextSrv } from 'app/core/core';
import { isSoloRoute } from 'app/routes/utils';

import { TopBanner } from './TopBanner';

export function initAnnouncementBanners() {
  // TODO: Enable anonymous user visibility after backend support is enabled
  if (contextSrv.isSignedIn) {
    // Make sure the banner is not shown on solo panels and during image renderer requests
    if (!isSoloRoute(locationService.getLocation().pathname) && contextSrv.user.authenticatedBy !== 'render') {
      addPageBanner(TopBanner);
    }
  }
}
