import { css } from '@emotion/css';
import { useMemo, createRef } from 'react';
import { useAsync } from 'react-use';

import { Field, LinkModel, PanelProps } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { TraceView } from 'app/features/explore/TraceView/TraceView';
import { SpanLinkFunc } from 'app/features/explore/TraceView/components';
import { transformDataFrames } from 'app/features/explore/TraceView/utils/transform';

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
}

export const TracesPanel = ({ data, options }: PanelProps<TracesPanelOptions>) => {
  const topOfViewRef = createRef<HTMLDivElement>();
  const traceProp = useMemo(() => transformDataFrames(data.series[0]), [data.series]);
  const dataSource = useAsync(async () => {
    return await getDataSourceSrv().get(data.request?.targets[0].datasource?.uid);
  });

  if (!data || !data.series.length || !traceProp) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
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
      />
    </div>
  );
};
