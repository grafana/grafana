import { CheckUpdatesResponse } from 'app/percona/shared/services/updates/Updates.types';

import { CheckUpdatesPayload, CheckUpdatesChangeLogs, CheckUpdatesChangeLogsResponse } from './updates.types';

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

export const mapUpdatesChangeLogs = (response: CheckUpdatesChangeLogsResponse): CheckUpdatesChangeLogs => {
  const responseMapping = response.updates.map((item) => ({
    version: item.version,
    tag: item.tag,
    timestamp: item.timestamp,
    releaseNotesUrl: item.release_notes_url,
    releaseNotesText: item.release_notes_text,
  }));
  return {
    lastCheck: response.last_check,
    updates: responseMapping,
  };
};
