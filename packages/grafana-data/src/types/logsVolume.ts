import { DataQuery } from './query';
import { DataQueryRequest, DataQueryResponse, DataSourceApi, DataSourceJsonData } from './datasource';
import { Observable } from 'rxjs';

/**
 * TODO: This should be added ot ./logs.ts but because of cross reference between ./datasource.ts and ./logs.ts it can
 * be done only after decoupling "logs" from "datasource"
 *
 * @internal
 */
export interface DataSourceWithLogsVolumeSupport<
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
> extends DataSourceApi<TQuery, TOptions> {
  getLogsVolumeDataProvider(request: DataQueryRequest<TQuery>): Observable<DataQueryResponse> | undefined;
}

export const hasLogsVolumeSupport = <
  TQuery extends DataQuery = DataQuery,
  TOptions extends DataSourceJsonData = DataSourceJsonData
>(
  datasource: DataSourceApi<TQuery, TOptions>
): datasource is DataSourceWithLogsVolumeSupport<TQuery, TOptions> => {
  // @ts-ignore
  return Boolean(datasource.getLogsVolumeDataProvider);
};
