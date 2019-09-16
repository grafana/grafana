import React from 'react';
import { ResponsiveButton } from './ResponsiveButton';
import { RefreshPicker } from '@grafana/ui';

type Props = {
  splitted: boolean;
  loading: boolean;
  onRun: () => void;
  refreshInterval: string;
  onChangeRefreshInterval: (interval: string) => void;
  showDropdown: boolean;
};

export function RunButton(props: Props) {
  const { splitted, loading, onRun, onChangeRefreshInterval, refreshInterval, showDropdown } = props;
  const runButton = (
    <ResponsiveButton
      splitted={splitted}
      title="Run Query"
      onClick={onRun}
      buttonClassName="navbar-button--secondary btn--radius-right-0 "
      iconClassName={loading ? 'fa fa-spinner fa-fw fa-spin run-icon' : 'fa fa-level-down fa-fw run-icon'}
    />
  );

  if (showDropdown) {
    return (
      <RefreshPicker
        onIntervalChanged={onChangeRefreshInterval}
        value={refreshInterval}
        buttonSelectClassName="navbar-button--secondary"
        refreshButton={runButton}
      />
    );
  }
  return runButton;
}
