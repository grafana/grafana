

import { useEffect, useMemo, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import { DataFrame, DataSourceApi, GrafanaTheme2, TimeRange } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { TraceView } from 'app/features/explore/TraceView/TraceView';
import { transformDataFrames } from 'app/features/explore/TraceView/utils/transform';
import { SearchTableType } from 'app/plugins/datasource/tempo/dataquery.gen';

import { useLogListContext } from './LogListContext';
import { EmbeddedInternalLink } from './links';

interface Props {
  traceRef: EmbeddedInternalLink;
  timeRange: TimeRange;
  timeZone: string;
}

export const LogLineDetailsTrace = ({ timeRange, timeZone, traceRef }: Props) => {
  const [dataSource, setDataSource] = useState<DataSourceApi | null>(null);
  const [dataFrames, setDataFrames] = useState<DataFrame[] | null | undefined>(undefined);
  const { app } = useLogListContext();

  useEffect(() => {
    getDataSourceSrv().get(traceRef.dsUID)
      .then((dataSource) => {
        if (dataSource) {
          setDataSource(dataSource);
        } else {
          setDataFrames(null);
        }
      });
  }, [traceRef.dsUID]);

  useEffect(() => {
    if (!dataSource) {
      return;
    }
    lastValueFrom(dataSource.query({
      app,
      requestId: 'test',
      targets: [{
        query: traceRef.query,
        queryType: 'traceql',
        refId: 'log-line-details-trace',
        tableType: SearchTableType.Traces,
        filters: []
      }],
      interval: '',
      intervalMs: 0,
      range: timeRange,
      scopedVars: {},
      timezone: timeZone,
      startTime: Date.now(),
    })).then(response => {
      setDataFrames(response.data);
    })
  }, [app, dataSource, timeRange, timeZone, traceRef.query]);

  const traceProp = useMemo(() => dataFrames?.length ? transformDataFrames(dataFrames[0]) : undefined, [dataFrames]);
  
  return (
    <div>
       {dataSource && Array.isArray(dataFrames) && traceProp && (
        <TraceView
          dataFrames={dataFrames}
          traceProp={traceProp}
          datasource={dataSource}
          timeRange={timeRange}
        />
       )}
    </div>
  );
};


const getStyles = (theme: GrafanaTheme2) => ({
});
