import { type NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';

import { NavID, NavWeight } from '../constants';
import { isSignedIn } from '../utils';

/** Home is unconditional and seeds the tree */
export function getHomeNode(): NavModelItem {
  // cfg.HomePage redirects are not reproduced: that setting is not exposed to
  // the frontend. The router's default home handling applies instead.
  const homeUrl = !isSignedIn() && !config.anonymousEnabled ? '/login' : '/';

  return {
    text: 'Home',
    id: NavID.home,
    url: homeUrl,
    icon: 'home-alt',
    sortWeight: NavWeight.home,
  };
}
