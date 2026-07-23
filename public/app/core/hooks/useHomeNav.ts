import { type NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useFlagGrafanaUnifiedHomepage } from '@grafana/runtime/internal';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';
import { useSelector } from 'app/types/store';

export const SETUP_GUIDE_HOME_URL = '/a/grafana-setupguide-app/home';

/**
 * Returns the home nav item. When the unified homepage is enabled, a stale
 * `home_page` config pointing at the setup guide app is superseded by the new
 * homepage, so the link is rewritten to the root URL.
 */
export function useHomeNav(): NavModelItem | undefined {
  const homeNav = useSelector((state) => state.navIndex[HOME_NAV_ID]);
  const unifiedHomepageEnabled = useFlagGrafanaUnifiedHomepage();

  if (unifiedHomepageEnabled && homeNav?.url === SETUP_GUIDE_HOME_URL) {
    return { ...homeNav, url: config.appSubUrl + '/' };
  }

  return homeNav;
}
