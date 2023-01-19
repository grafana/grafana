import React from 'react';

import {
  CoreApp,
  DataQueryResponse,
  DataSourceApi,
  LoadingState,
  LogsDedupStrategy,
  SplitOpen,
  TimeZone,
} from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Collapse } from '@grafana/ui';
import { dataFrameToLogsModel } from 'app/core/logsModel';
import store from 'app/core/store';

import { LogRows } from '../logs/components/LogRows';

import { SupplementaryResultError } from './SupplementaryResultError';
import { SETTINGS_KEYS } from './utils/logs';

type Props = {
  data: DataQueryResponse | undefined;
  enabled: boolean;
  setLogsSampleEnabled: (enabled: boolean) => void;
  timeZone: TimeZone;
  splitOpen: SplitOpen;
  datasourceInstance: DataSourceApi | null;
};

export function LogsSamplePanel(props: Props) {
  const { data, timeZone, enabled, setLogsSampleEnabled, datasourceInstance, splitOpen } = props;

  const onToggleLogsSampleCollapse = (isOpen: boolean) => {
    setLogsSampleEnabled(isOpen);
    reportInteraction('grafana_explore_logs_sample_toggle_clicked', {
      datasourceType: datasourceInstance ? datasourceInstance?.type : 'unknown',
      type: isOpen ? 'open' : 'close',
    });
  };

  let LogsSamplePanelContent: JSX.Element | null;

  if (data === undefined) {
    LogsSamplePanelContent = null;
  } else if (data?.error !== undefined) {
    LogsSamplePanelContent = (
      <SupplementaryResultError error={data.error} title="Failed to load log samples for this query" />
    );
  } else if (data?.state === LoadingState.Loading) {
    LogsSamplePanelContent = <span>Log samples are loading...</span>;
  } else if (data?.data.length === 0) {
    LogsSamplePanelContent = <span>No log sample data.</span>;
  } else {
    const logs = dataFrameToLogsModel(data.data, undefined);
    console.log(logs);
    LogsSamplePanelContent = (
      <LogRows
        logRows={logs.rows}
        dedupStrategy={LogsDedupStrategy.none}
        showLabels={store.getBool(SETTINGS_KEYS.showLabels, false)}
        showTime={store.getBool(SETTINGS_KEYS.showTime, true)}
        wrapLogMessage={store.getBool(SETTINGS_KEYS.wrapLogMessage, true)}
        prettifyLogMessage={store.getBool(SETTINGS_KEYS.prettifyLogMessage, false)}
        timeZone={timeZone}
        enableLogDetails={true}
        app={CoreApp.Explore}
      />
    );
  }
  return (
    <Collapse label="Logs sample" isOpen={enabled} collapsible={true} onToggle={onToggleLogsSampleCollapse}>
      {LogsSamplePanelContent}
    </Collapse>
  );
}
