import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2, type TimeRange, type TimeZone, toUtc } from '@grafana/data';
import { TimeRangeInput, useStyles2, type WeekStart } from '@grafana/ui';

interface Props {
  value: TimeRange;
  timeZone: TimeZone;
  weekStart?: WeekStart;
  onChange: (timeRange: TimeRange) => void;
  onChangeTimeZone: (timeZone: TimeZone) => void;
}

/**
 * The notebook's time range, as a fixed window rather than a relative one.
 *
 * TimeRangeInput rather than the toolbar picker: this sits in the document beside the tags, so it
 * reads as a field. It also drops the shift, zoom and refresh buttons, which is what the notebook
 * wants — nothing here nudges the window a half-span at a time.
 */
export function NotebookTimeRangePicker({ value, timeZone, weekStart, onChange, onChangeTimeZone }: Props) {
  const styles = useStyles2(getStyles);

  // A notebook records a moment, so the row says which six hours rather than "Last 6 hours". Display
  // only: what the scene holds is left alone until someone actually picks a range, so a notebook
  // saved with a relative range keeps it.
  const displayValue = useMemo((): TimeRange => {
    const from = toUtc(value.from);
    const to = toUtc(value.to);
    return { from, to, raw: { from, to } };
  }, [value]);

  // hideQuickRanges takes the presets away, but the From/To fields still accept `now-6h`, and
  // convertRawToRange deliberately keeps a math string in `raw`. Pinning here is what makes every
  // route through the picker end in a fixed window.
  const onPick = (picked: TimeRange) => {
    const from = toUtc(picked.from);
    const to = toUtc(picked.to);
    onChange({ from, to, raw: { from, to } });
  };

  return (
    <div className={styles.picker}>
      <TimeRangeInput
        value={displayValue}
        timeZone={timeZone}
        weekStart={weekStart}
        onChange={onPick}
        onChangeTimeZone={onChangeTimeZone}
        hideQuickRanges
        // TimeRangeInput hides the timezone footer by default. Notebooks persist a timezone, so
        // leaving the default would quietly make it unreachable.
        hideTimeZone={false}
        showIcon
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Input styles are width:100%, and the header's Stack aligns to flex-start, so the control would
  // otherwise collapse to the caret. Wide enough for two formatted timestamps.
  picker: css({
    minWidth: theme.spacing(45),
    maxWidth: '100%',
  }),
});
