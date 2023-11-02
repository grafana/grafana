import { lastValueFrom } from 'rxjs';

import { DataFrame, DataQueryRequest } from '@grafana/data';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { PyroscopeDataSource } from 'app/plugins/datasource/grafana-pyroscope-datasource/datasource';
import { Query } from 'app/plugins/datasource/grafana-pyroscope-datasource/types';

export const getProfileFrame = async (request: DataQueryRequest<Query>, datasourceUid: string) => {
  const ds = await getDatasourceSrv().get(datasourceUid);
  if (ds instanceof PyroscopeDataSource) {
    const result = await lastValueFrom(ds.query(request));
    const frame = result.data.find((x: DataFrame) => {
      return x.name === 'response';
    });
    if (frame && frame.length > 1) {
      return frame;
    }
  }
};
