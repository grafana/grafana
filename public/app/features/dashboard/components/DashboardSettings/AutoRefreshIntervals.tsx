import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Input, Tooltip } from '@grafana/ui';
import { defaultIntervals } from '@grafana/ui/src/components/RefreshPicker/RefreshPicker';

import { getTimeSrv } from '../../services/TimeSrv';

interface Props {
  renderCount: number;
  refreshIntervals: string[];
  onRefreshIntervalChange: (interval: string[]) => void;
}

export const AutoRefreshIntervals: FC<Props> = ({ renderCount, refreshIntervals, onRefreshIntervalChange }) => {
  const [intervals, setIntervals] = useState<string[]>(
    getTimeSrv().getValidIntervals(refreshIntervals ?? defaultIntervals)
  );
  const [invalidIntervalsMessage, setInvalidIntervalsMessage] = useState<string | null>(null);

  useEffect(() => {
    const intervals = getTimeSrv().getValidIntervals(refreshIntervals ?? defaultIntervals);
    setIntervals(intervals);
  }, [renderCount, refreshIntervals]);

  const intervalsString = useMemo(() => {
    if (!Array.isArray(intervals)) {
      return '';
    }

    return intervals.join(',');
  }, [intervals]);

  const onIntervalsChange = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      if (!event.currentTarget.value) {
        return;
      }

      const newIntervals = event.currentTarget.value.split(',');
      const invalidMessage = validateIntervals(newIntervals);

      setIntervals(newIntervals);
      setInvalidIntervalsMessage(invalidMessage);
    },
    [setIntervals, setInvalidIntervalsMessage]
  );

  const onIntervalsBlur = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      if (!event.currentTarget.value || invalidIntervalsMessage) {
        return;
      }

      onRefreshIntervalChange(getValidIntervals(intervals));
    },
    [intervals, onRefreshIntervalChange]
  );

  return (
    <div className="gf-form">
      <span className="gf-form-label width-7">Auto-refresh</span>
      {invalidIntervalsMessage && (
        <Tooltip placement="right" content={invalidIntervalsMessage}>
          <Input width={60} invalid value={intervalsString} onChange={onIntervalsChange} onBlur={onIntervalsBlur} />
        </Tooltip>
      )}
      {!invalidIntervalsMessage && (
        <Input width={60} value={intervalsString} onChange={onIntervalsChange} onBlur={onIntervalsBlur} />
      )}
    </div>
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
    return err.message;
  }
};

export const getValidIntervals = (
  intervals: string[],
  dependencies: { getTimeSrv: typeof getTimeSrv } = { getTimeSrv }
) => {
  const cleanIntervals = intervals.filter(i => i.trim() !== '').map(interval => interval.replace(/\s+/g, ''));
  return [...new Set(dependencies.getTimeSrv().getValidIntervals(cleanIntervals))];
};
