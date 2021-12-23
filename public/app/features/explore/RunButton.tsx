import React from 'react';
import { RefreshPicker, defaultIntervals } from '@grafana/ui';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';

export type Props = {
  isSmall?: boolean;
  loading: boolean;
  isLive: boolean;
  onRun: (loading: boolean) => void;
  refreshInterval?: string;
  onChangeRefreshInterval: (interval: string) => void;
  showDropdown: boolean;
};

export function RunButton(props: Props) {
  const { isSmall, loading, onRun, onChangeRefreshInterval, refreshInterval, showDropdown, isLive } = props;
  const intervals = getTimeSrv().getValidIntervals(defaultIntervals);
  let text: string | undefined = loading ? 'Cancel' : 'Run query';
  let width = '108px';

  if (isLive) {
    return null;
  }

  if (isSmall) {
    text = undefined;
    width = '35px';
  }

  return (
    <RefreshPicker
      onIntervalChanged={onChangeRefreshInterval}
      value={refreshInterval}
      isLoading={loading}
      text={text}
      intervals={intervals}
      isLive={isLive}
      onRefresh={() => onRun(loading)}
      noIntervalPicker={!showDropdown}
      primary={true}
      width={width}
    />
  );
}
