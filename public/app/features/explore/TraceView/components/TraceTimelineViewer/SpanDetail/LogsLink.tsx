import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { firstValueFrom, timeout } from 'rxjs';
import { filter } from 'rxjs/operators';

import {
  CoreApp,
  type DataFrame,
  type DataQuery,
  getDefaultTimeRange,
  type GrafanaTheme2,
  LoadingState,
  type TimeRange,
} from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { useStyles2, DataLinkButton } from '@grafana/ui';
import { getNextRequestId } from 'app/features/query/state/PanelQueryRunner';
import { runRequest } from 'app/features/query/state/runRequest';

import { type SpanLinkModel } from '../../types/links';

interface Props {
  spanLinkModel: SpanLinkModel;
}

export const LogsLinkButton = ({ spanLinkModel }: Props) => {
  const styles = useStyles2(getStyles);
  const presence = useHasLogs(spanLinkModel);
  const { linkModel, icon, className } = spanLinkModel;

  return (
    <span className={styles}>
      <DataLinkButton
        link={linkModel}
        buttonProps={{ icon, className, variant: presence === 'absent' ? 'secondary' : 'primary' }}
      ></DataLinkButton>
    </span>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return css({
    [theme.breakpoints.down('sm')]: {
      span: { display: 'none' },
    },
  });
}

const LOGS_CHECK_TIMEOUT_MS = 5_000;

type LogsPresence = 'loading' | 'present' | 'absent';

/**
 * Runs the link's interpolated query against its datasource to determine whether
 * any logs exist for the span, so the button can be disabled when there is nothing to link to.
 */
function useHasLogs(spanLinkModel: SpanLinkModel): LogsPresence {
  const [presence, setPresence] = useState<LogsPresence>('loading');

  useEffect(() => {
    const interpolatedParams = spanLinkModel.linkModel.interpolatedParams;
    const query = interpolatedParams?.query;

    // Without an interpolated query we can't check, so assume logs may exist and leave the link enabled.
    if (!query) {
      setPresence('present');
      return;
    }

    const timeRange = interpolatedParams?.timeRange ?? getDefaultTimeRange();
    let cancelled = false;

    checkForLogs(query, timeRange)
      .then((hasLogs) => {
        if (!cancelled) {
          setPresence(hasLogs ? 'present' : 'absent');
        }
      })
      .catch(() => {
        // If the check fails we don't want to hide a potentially valid link, so keep it enabled.
        if (!cancelled) {
          setPresence('present');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [spanLinkModel]);

  return presence;
}

async function checkForLogs(query: DataQuery, timeRange: TimeRange): Promise<boolean> {
  const datasource = await getDataSourceSrv().get(query.datasource ?? null);

  const request = {
    requestId: getNextRequestId(),
    app: CoreApp.Explore,
    targets: [query],
    range: timeRange,
    timezone: 'browser',
    interval: '1m',
    intervalMs: 60000,
    maxDataPoints: 1,
    scopedVars: {},
    startTime: Date.now(),
  };

  const panelData = await firstValueFrom(
    runRequest(datasource, request).pipe(
      filter((data) => data.state === LoadingState.Done || data.state === LoadingState.Error),
      timeout(LOGS_CHECK_TIMEOUT_MS)
    )
  );

  const series: DataFrame[] = panelData.series ?? [];
  return series.some((frame) => frame.length > 0 && frame.meta?.preferredVisualisationType === 'logs');
}