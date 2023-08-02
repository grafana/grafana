import { css } from '@emotion/css';
import React from 'react';

import {
  DataQueryResponse,
  DataSourceApi,
  GrafanaTheme2,
  hasSupplementaryQuerySupport,
  LoadingState,
  LogsDedupStrategy,
  SplitOpen,
  SupplementaryQueryType,
} from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { DataQuery, TimeZone } from '@grafana/schema';
import { Button, Collapse, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { dataFrameToLogsModel } from 'app/core/logsModel';
import store from 'app/core/store';

import { LogRows } from '../logs/components/LogRows';

import { SupplementaryResultError } from './SupplementaryResultError';
import { SETTINGS_KEYS } from './utils/logs';

type Props = {
  queryResponse: DataQueryResponse | undefined;
  enabled: boolean;
  timeZone: TimeZone;
  queries: DataQuery[];
  datasourceInstance: DataSourceApi | null | undefined;
  splitOpen: SplitOpen;
  setLogsSampleEnabled: (enabled: boolean) => void;
};

export function LogsSamplePanel(props: Props) {
  const { queryResponse, timeZone, enabled, setLogsSampleEnabled, datasourceInstance, queries, splitOpen } = props;

  const styles = useStyles2(getStyles);
  const onToggleLogsSampleCollapse = (isOpen: boolean) => {
    setLogsSampleEnabled(isOpen);
    reportInteraction('grafana_explore_logs_sample_toggle_clicked', {
      datasourceType: datasourceInstance?.type ?? 'unknown',
      type: isOpen ? 'open' : 'close',
    });
  };

  const OpenInSplitViewButton = () => {
    if (!hasSupplementaryQuerySupport(datasourceInstance, SupplementaryQueryType.LogsSample)) {
      return null;
    }

    const logSampleQueries = queries
      .map((query) => datasourceInstance.getSupplementaryQuery({ type: SupplementaryQueryType.LogsSample }, query))
      .filter((query): query is DataQuery => !!query);

    if (!logSampleQueries.length) {
      return null;
    }

    const onSplitOpen = () => {
      splitOpen({ queries: logSampleQueries, datasourceUid: datasourceInstance.uid });
      reportInteraction('grafana_explore_logs_sample_split_button_clicked', {
        datasourceType: datasourceInstance?.type ?? 'unknown',
        queriesCount: logSampleQueries.length,
      });
    };

    return (
      <Button size="sm" className={styles.logSamplesButton} onClick={onSplitOpen}>
        Open logs in split view
      </Button>
    );
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
      <>
        <OpenInSplitViewButton />
        <div className={styles.logContainer}>
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
        </div>
      </>
    );
  }

  return queryResponse?.state !== LoadingState.NotStarted ? (
    <Collapse
      label={
        <div>
          Logs sample
          <Tooltip content="Show log lines that contributed to visualized metrics">
            <Icon name="info-circle" className={styles.infoTooltip} />
          </Tooltip>
        </div>
      }
      isOpen={enabled}
      collapsible={true}
      onToggle={onToggleLogsSampleCollapse}
    >
      {LogsSamplePanelContent}
    </Collapse>
  ) : null;
}

const getStyles = (theme: GrafanaTheme2) => ({
  logSamplesButton: css`
    position: absolute;
    top: ${theme.spacing(1)};
    right: ${theme.spacing(1)};
  `,
  logContainer: css`
    overflow-x: scroll;
  `,
  infoTooltip: css`
    margin-left: ${theme.spacing(1)};
  `,
});
