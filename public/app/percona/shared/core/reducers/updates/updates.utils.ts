import { CheckUpdatesResponse } from 'app/percona/shared/services/updates/Updates.types';

import { CheckUpdatesPayload } from './updates.types';

export const responseToPayload = (response: CheckUpdatesResponse): CheckUpdatesPayload => ({
  installed: response.installed
    ? {
        version: response.installed.version,
        fullVersion: response.installed.full_version,
        timestamp: response.installed.timestamp,
      }
    : undefined,
  latest: response.latest
    ? {
        version: response.latest.version,
        tag: response.latest.tag,
        timestamp: response.latest.timestamp,
      }
    : undefined,
  lastChecked: response.last_check,
  latestNewsUrl: response.latest_news_url,
  updateAvailable: !!response.update_available,
});
