import React from 'react';
import { RefreshPicker, defaultIntervals } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';

export type Props = {
  small?: boolean;
  loading: boolean;
  isLive: boolean;
  onRun: (loading: boolean) => void;
  refreshInterval?: string;
  onChangeRefreshInterval: (interval: string) => void;
  showDropdown: boolean;
};

export function RunButton(props: Props) {
  const { small, loading, onRun, onChangeRefreshInterval, refreshInterval, showDropdown, isLive } = props;
  const intervals = getTimeSrv().getValidIntervals(defaultIntervals);
  let text: string | undefined;

  if (!isLive && !small) {
    text = loading ? 'Cancel' : 'Run query';
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
      tooltip="Execute query"
      aria-label={selectors.pages.Explore.General.runButton}
    />
  );
}
