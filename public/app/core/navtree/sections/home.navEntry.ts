import { type NavModelItem } from '@grafana/data';

import { NavID, NavWeight } from '../constants';
import { anonymousOrSignedIn } from '../utils';

/** Home is unconditional and seeds the tree */
export function getHomeNode(): NavModelItem {
  // cfg.HomePage redirects are not reproduced: that setting is not exposed to
  // the frontend. The router's default home handling applies instead.
  const homeUrl = anonymousOrSignedIn() ? '/' : '/login';

  return {
    text: 'Home',
    id: NavID.home,
    url: homeUrl,
    icon: 'home-alt',
    sortWeight: NavWeight.home,
  };
}
