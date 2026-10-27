import {
  type ResolvedContactPoint,
  useResolvedContactPoint,
} from '../../contactPoints/hooks/v1beta1/useResolvedContactPoint';
import { type TimeIntervalView, useListTimeIntervals } from '../../muteTimings/hooks/useListTimeIntervals';
import { useResolvedRoutingTree } from '../../notificationPolicies/hooks/useResolvedRoutingTree';
import { type RoutingTimings, TIMING_DEFAULTS } from '../constants';
import { type ContactPointRoutingSettings } from '../notificationSettingsValue';
import { type RoutingTimingError, getRoutingTimingErrors } from '../utils/promDuration';

export interface ContactPointSettingsStateOptions {
  value: ContactPointRoutingSettings | null;
  /** Treats no contact point as valid. A missing or unusable contact point is still invalid. */
  allowEmpty?: boolean;
  /** The muting, grouping and timings are not shown, so they are not validated and time intervals are not requested. */
  hideRoutingOptions?: boolean;
}

interface ContactPointSettingsState {
  /** See `useResolvedContactPoint`. */
  status: ResolvedContactPoint['status'];
  /** The value `ContactPointSelector` expects, once the contact point is `found`. */
  selectorValue: string | null;
  /** The saved contact point is missing or can't be used, so the user has to pick another one. */
  isReceiverUnavailable: boolean;
  timeIntervals: TimeIntervalView[];
  isLoadingTimeIntervals: boolean;
  isTimeIntervalsError: boolean;
  /** Selected mute or active intervals that no longer exist or can't be used. Empty while the list loads, fails or is not requested. */
  unavailableTimeIntervals: string[];
  /** Timings the backend would reject, with why: `format` for a malformed duration or milliseconds, `zero` for a zero
   * group or repeat interval. Unset timings are valid because they are inherited. */
  timingErrors: Partial<Record<keyof RoutingTimings, RoutingTimingError>>;
  /** What unset timings fall back to: the default policy's, or Alertmanager's built-in defaults. The built-in defaults
   * also show while the default policy loads or fails to load. */
  inheritedTimings: Required<RoutingTimings>;
  /** Whether the value can be saved. False for a missing or unusable contact point, and until selected time intervals
   * have been looked up. A contact point that is still being looked up, or whose lookup failed, counts as valid:
   * the backend rejects an unknown one, and `status` lets the consumer show why it could not be confirmed. */
  isValid: boolean;
}

/** Everything a consumer needs to render the contact point selection and decide whether it can be saved.
 * It requests contact points, routing trees and time intervals unconditionally: the package has no Alertmanager
 * provider to gate on, so consumers decide whether to render it for users without access. */
export function useContactPointSettingsState({
  value,
  allowEmpty,
  hideRoutingOptions,
}: ContactPointSettingsStateOptions): ContactPointSettingsState {
  const { status, selectorValue } = useResolvedContactPoint(value?.receiver);
  const isReceiverUnavailable = status === 'notFound' || status === 'unusable';

  const {
    timeIntervals,
    isLoading: isLoadingTimeIntervals,
    isError: isTimeIntervalsError,
  } = useListTimeIntervals({ skip: hideRoutingOptions });
  const usableTimeIntervals = new Set(
    timeIntervals.filter((interval) => interval.canUse).map((interval) => interval.name)
  );
  const selectedTimeIntervals = [
    ...new Set([...(value?.muteTimeIntervals ?? []), ...(value?.activeTimeIntervals ?? [])]),
  ];
  const unavailableTimeIntervals =
    hideRoutingOptions || isLoadingTimeIntervals || isTimeIntervalsError
      ? []
      : selectedTimeIntervals.filter((name) => !usableTimeIntervals.has(name));
  const hasValidTimeIntervals =
    selectedTimeIntervals.length === 0 ||
    (!isLoadingTimeIntervals && !isTimeIntervalsError && unavailableTimeIntervals.length === 0);

  const timingErrors = getRoutingTimingErrors(value ?? {});

  // Simplified-routing rules inherit unset timings from the default policy tree.
  const { tree: defaultTree } = useResolvedRoutingTree();
  const inheritedTimings = {
    groupWait: defaultTree?.defaults.groupWait ?? TIMING_DEFAULTS.groupWait,
    groupInterval: defaultTree?.defaults.groupInterval ?? TIMING_DEFAULTS.groupInterval,
    repeatInterval: defaultTree?.defaults.repeatInterval ?? TIMING_DEFAULTS.repeatInterval,
  };

  const isValid =
    (allowEmpty || Boolean(value?.receiver)) &&
    !isReceiverUnavailable &&
    (hideRoutingOptions || (Object.keys(timingErrors).length === 0 && hasValidTimeIntervals));

  return {
    status,
    selectorValue,
    isReceiverUnavailable,
    timeIntervals,
    isLoadingTimeIntervals,
    isTimeIntervalsError,
    unavailableTimeIntervals,
    timingErrors,
    inheritedTimings,
    isValid,
  };
}
