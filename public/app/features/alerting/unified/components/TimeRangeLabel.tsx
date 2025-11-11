import { RelativeTimeRange, rangeUtil } from '@grafana/data';
import { Trans } from '@grafana/i18n';

interface RuleTimeRangeLabelProps {
  relativeTimeRange: RelativeTimeRange;
}

/**
 * Displays a human-readable relative time range label like:
 * - "15m to now" when to === 0 or not set
 * - "15m to 1m" when to > 0
 */
export function TimeRangeLabel({ relativeTimeRange }: RuleTimeRangeLabelProps) {
  const fromLabel = rangeUtil.secondsToHms(relativeTimeRange.from);
  const toSeconds = relativeTimeRange.to ?? 0;
  const toIsNow = !toSeconds || toSeconds <= 0;
  const toLabel = toIsNow ? 'now' : rangeUtil.secondsToHms(toSeconds);

  if (toIsNow) {
    return (
      <Trans i18nKey="alerting.rule-time-range-label.relative" values={{ from: fromLabel }}>
        <code>{'{{from}}'}</code> to now
      </Trans>
    );
  }

  return (
    <Trans i18nKey="alerting.rule-time-range-label.relative-with-to" values={{ from: fromLabel, to: toLabel }}>
      <code>{'{{from}}'}</code> to <code>{'{{to}}'}</code>
    </Trans>
  );
}
