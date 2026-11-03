import { notificationsAPI } from '../../api/notifications';
import { isUsable } from '../../common/isUsable';

export interface TimeIntervalView {
  /** The title rules reference the interval by; it can differ from the resource name. */
  name: string;
  /** Imported from an external Alertmanager: rule validation rejects it, so it can't be picked. */
  isImported: boolean;
}

export type TimeIntervalsStatus = 'skipped' | 'loading' | 'success' | 'error';

/** Mute and active timings share this one resource type; a rule's own muteTimeIntervals/activeTimeIntervals
 * field decides which side a name is used on. A refetch that fails keeps the last good list. */
export function useListTimeIntervals({ skip }: { skip?: boolean } = {}): {
  status: TimeIntervalsStatus;
  timeIntervals: TimeIntervalView[];
} {
  const { currentData, isError } = notificationsAPI.useListTimeIntervalQuery(
    {},
    { refetchOnFocus: true, refetchOnMountOrArgChange: true, skip }
  );

  const timeIntervals = (currentData?.items ?? []).map((interval) => ({
    name: interval.spec.name,
    isImported: !isUsable(interval),
  }));

  if (skip) {
    return { status: 'skipped', timeIntervals };
  }
  if (isError && !currentData) {
    return { status: 'error', timeIntervals };
  }
  return { status: currentData ? 'success' : 'loading', timeIntervals };
}
