import { Observable } from 'rxjs';

import { DataQueryRequest, DataQueryResponse } from './datasource';
import { DataQuery } from './query';

/**
 * TODO: This should be added to ./logs.ts but because of cross reference between ./datasource.ts and ./logs.ts it can
 * be done only after decoupling "logs" from "datasource" (https://github.com/grafana/grafana/pull/39536)
 *
 * @internal
 */
export interface DataSourceWithLogsVolumeSupport<TQuery extends DataQuery> {
  getLogsVolumeDataProvider(request: DataQueryRequest<TQuery>): Observable<DataQueryResponse> | undefined;
}

/**
 * @internal
 */
export const hasLogsVolumeSupport = <TQuery extends DataQuery>(
  datasource: unknown
): datasource is DataSourceWithLogsVolumeSupport<TQuery> => {
  return (datasource as DataSourceWithLogsVolumeSupport<TQuery>).getLogsVolumeDataProvider !== undefined;
};
