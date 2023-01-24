import React from 'react';

import { DataQueryResponse, DataSourceApi, LoadingState, LogsDedupStrategy } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { TimeZone } from '@grafana/schema';
import { Collapse } from '@grafana/ui';
import { dataFrameToLogsModel } from 'app/core/logsModel';
import store from 'app/core/store';

import { LogRows } from '../logs/components/LogRows';

import { SupplementaryResultError } from './SupplementaryResultError';
import { SETTINGS_KEYS } from './utils/logs';

type Props = {
  queryResponse: DataQueryResponse | undefined;
  enabled: boolean;
  timeZone: TimeZone;
  datasourceInstance: DataSourceApi | null | undefined;
  setLogsSampleEnabled: (enabled: boolean) => void;
};

export function LogsSamplePanel(props: Props) {
  const { queryResponse, timeZone, enabled, setLogsSampleEnabled, datasourceInstance } = props;

  const onToggleLogsSampleCollapse = (isOpen: boolean) => {
    setLogsSampleEnabled(isOpen);
    reportInteraction('grafana_explore_logs_sample_toggle_clicked', {
      datasourceType: datasourceInstance?.type ?? 'unknown',
      type: isOpen ? 'open' : 'close',
    });
  };

  let LogsSamplePanelContent: JSX.Element | null;

  if (queryResponse === undefined) {
    LogsSamplePanelContent = null;
  } else if (queryResponse.error !== undefined) {
    LogsSamplePanelContent = (
      <SupplementaryResultError error={queryResponse.error} title="Failed to load logs sample for this query" />
    );
  } else if (queryResponse.state === LoadingState.Loading) {
    LogsSamplePanelContent = <span>Logs sample is loading...</span>;
  } else if (queryResponse.data.length === 0 || queryResponse.data[0].length === 0) {
    LogsSamplePanelContent = <span>No logs sample data.</span>;
  } else {
    const logs = dataFrameToLogsModel(queryResponse.data);
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
      />
    );
  }

  return (
    <Collapse label="Logs sample" isOpen={enabled} collapsible={true} onToggle={onToggleLogsSampleCollapse}>
      {LogsSamplePanelContent}
    </Collapse>
  );
}
