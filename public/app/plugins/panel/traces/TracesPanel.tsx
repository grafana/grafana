import { css } from '@emotion/css';
import { useMemo, createRef } from 'react';
import { useAsync } from 'react-use';

import { TraceSearchProps, Field, LinkModel, PanelProps } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { TraceView } from 'app/features/explore/TraceView/TraceView';
import { SpanLinkFunc } from 'app/features/explore/TraceView/components/types/links';
import { transformDataFrames } from 'app/features/explore/TraceView/utils/transform';

import { replaceSearchVariables } from '../../../features/explore/TraceView/useSearch';

const styles = {
  wrapper: css({
    height: '100%',
    overflow: 'scroll',
  }),
};

export interface TracesPanelOptions {
  createSpanLink?: SpanLinkFunc;
  focusedSpanId?: string;
  createFocusSpanLink?: (traceId: string, spanId: string) => LinkModel<Field>;
  spanFilters?: TraceSearchProps;
}

export const TracesPanel = ({ data, options, replaceVariables }: PanelProps<TracesPanelOptions>) => {
  const topOfViewRef = createRef<HTMLDivElement>();
  const traceProp = useMemo(() => transformDataFrames(data.series[0]), [data.series]);
  const dataSource = useAsync(async () => {
    return await getDataSourceSrv().get(data.request?.targets[0].datasource?.uid);
  });

  if (!data || !data.series.length || !traceProp) {
    return (
      <div className="panel-empty">
        <p>
          <Trans i18nKey="traces.traces-panel.no-data-found-in-response">No data found in response</Trans>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div ref={topOfViewRef}></div>
      <TraceView
        dataFrames={data.series}
        scrollElementClass={styles.wrapper}
        traceProp={traceProp}
        datasource={dataSource.value}
        topOfViewRef={topOfViewRef}
        createSpanLink={options.createSpanLink}
        focusedSpanId={options.focusedSpanId}
        createFocusSpanLink={options.createFocusSpanLink}
        spanFilters={replaceSearchVariables(replaceVariables, options.spanFilters)}
        timeRange={data.timeRange}
      />
    </div>
  );
};
