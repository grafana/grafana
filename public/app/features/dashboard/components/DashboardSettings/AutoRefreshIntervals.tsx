import { useCallback, useEffect, useMemo, useState } from 'react';
import * as React from 'react';

import { t } from '@grafana/i18n';
import { Input, defaultIntervals, Field } from '@grafana/ui';

import { getTimeSrv } from '../../services/TimeSrv';

export interface Props {
  refreshIntervals?: string[];
  onRefreshIntervalChange: (interval: string[]) => void;
  getIntervalsFunc?: typeof getValidIntervals;
  validateIntervalsFunc?: typeof validateIntervals;
}

export const AutoRefreshIntervals = ({
  refreshIntervals,
  onRefreshIntervalChange,
  getIntervalsFunc = getValidIntervals,
  validateIntervalsFunc = validateIntervals,
}: Props) => {
  const [intervals, setIntervals] = useState<string[]>(getIntervalsFunc(refreshIntervals ?? defaultIntervals));
  const [invalidIntervalsMessage, setInvalidIntervalsMessage] = useState<string | null>(null);

  useEffect(() => {
    const intervals = getIntervalsFunc(refreshIntervals ?? defaultIntervals);
    setIntervals(intervals);
  }, [getIntervalsFunc, refreshIntervals]);

  const intervalsString = useMemo(() => {
    if (!Array.isArray(intervals)) {
      return '';
    }

    return intervals.join(',');
  }, [intervals]);

  const onIntervalsChange = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      const newIntervals = event.currentTarget.value ? event.currentTarget.value.split(',') : [];

      setIntervals(newIntervals);
    },
    [setIntervals]
  );

  const onIntervalsBlur = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      const invalidMessage = validateIntervalsFunc(intervals);

      if (invalidMessage === null) {
        // only refresh dashboard JSON if intervals are valid
        onRefreshIntervalChange(getIntervalsFunc(intervals));
      }

      setInvalidIntervalsMessage(invalidMessage);
    },
    [getIntervalsFunc, intervals, onRefreshIntervalChange, validateIntervalsFunc]
  );

  return (
    <Field
      label={t('dashboard-settings.general.auto-refresh-label', 'Auto refresh')}
      description={t(
        'dashboard-settings.general.auto-refresh-description',
        "Define the auto refresh intervals that should be available in the auto refresh list. Use the format '5s' for seconds, '1m' for minutes, '1h' for hours, and '1d' for days (e.g.: '5s,10s,30s,1m,5m,15m,30m,1h,2h,1d')."
      )}
      error={invalidIntervalsMessage}
      invalid={!!invalidIntervalsMessage}
    >
      <Input
        id="auto-refresh-input"
        invalid={!!invalidIntervalsMessage}
        value={intervalsString}
        onChange={onIntervalsChange}
        onBlur={onIntervalsBlur}
      />
    </Field>
  );
};

export const validateIntervals = (
  intervals: string[],
  dependencies: { getTimeSrv: typeof getTimeSrv } = { getTimeSrv }
): string | null => {
  try {
    getValidIntervals(intervals, dependencies);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid intervals';
  }
};

export const getValidIntervals = (
  intervals: string[],
  dependencies: { getTimeSrv: typeof getTimeSrv } = { getTimeSrv }
) => {
  const cleanIntervals = intervals.filter((i) => i.trim() !== '').map((interval) => interval.replace(/\s+/g, ''));
  return [...new Set(dependencies.getTimeSrv().getValidIntervals(cleanIntervals))];
};
