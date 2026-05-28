import { config } from '@grafana/runtime';

import { useGetFolderUnreadCountQuery } from '../api/pulseApi';

/**
 * useFolderPulseUnreadCount fetches the unread Pulse thread count
 * rolled up across every dashboard the caller can read under the
 * given folder hierarchy. Powers the `tabCounter` on the folder
 * navmodel's Pulse tab, which is rendered by every folder tab page
 * (Dashboards / Library panels / Alerting / Pulse) so users see the
 * badge regardless of which tab they're on.
 *
 * Skips the request entirely when:
 *   - the `dashboardPulse` feature toggle is off (Pulse isn't even
 *     rendered, so the badge would be wasted bytes);
 *   - the folder UID is empty (root folder views still call this hook
 *     unconditionally; the skip flag keeps RTK from caching a
 *     permanent zero under an empty cache key).
 *
 * Returns `0` when skipped or while the request is in flight so
 * `buildNavModel` callers can pass the value through unconditionally
 * — the tab counter is suppressed for `0` at the model layer.
 */
export function useFolderPulseUnreadCount(folderUID: string | undefined): number {
  const pulseEnabled = Boolean(config.featureToggles?.dashboardPulse);
  const { data } = useGetFolderUnreadCountQuery(
    { folderUID: folderUID ?? '' },
    { skip: !pulseEnabled || !folderUID }
  );
  return data?.unreadCount ?? 0;
}
