import { notificationsAPI } from '../../api/notifications';

export interface TimeIntervalView {
  /** The title rules reference the interval by; it can differ from the resource name. */
  name: string;
  /** Imported intervals belong to an external Alertmanager and are rejected by rule validation. */
  canUse: boolean;
}

/** Mute and active timings share this one resource type; a rule's own muteTimeIntervals/activeTimeIntervals
 * field decides which side a name is used on. A refetch that fails keeps the last good list. */
export function useListTimeIntervals(): { timeIntervals: TimeIntervalView[]; isLoading: boolean; isError: boolean } {
  const { currentData, isLoading, isError } = notificationsAPI.useListTimeIntervalQuery(
    {},
    { refetchOnFocus: true, refetchOnMountOrArgChange: true }
  );

  // A missing annotation counts as unusable, as MuteTimingsSelector does.
  const timeIntervals = (currentData?.items ?? []).map((interval) => ({
    name: interval.spec.name,
    canUse: interval.metadata.annotations?.['grafana.com/canUse'] === 'true',
  }));

  return { timeIntervals, isLoading, isError: isError && !currentData };
}
