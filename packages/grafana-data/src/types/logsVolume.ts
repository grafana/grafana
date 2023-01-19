import { Observable } from 'rxjs';

import { DataQueryRequest, DataQueryResponse } from './datasource';
import { DataQuery } from './query';

/**
 * Support for DataSourceWithLogsVolumeSupport is deprecated and will be removed in the next major version.
 * Use DataSourceWithSupplementaryQueriesSupport instead.
 *
 * @deprecated
 */
export interface DataSourceWithLogsVolumeSupport<TQuery extends DataQuery> {
  getLogsVolumeDataProvider(request: DataQueryRequest<TQuery>): Observable<DataQueryResponse> | undefined;
}

/**
 * Support for hasLogsVolumeSupport is deprecated and will be removed in the next major version.
 * Use DataSourceWithSupplementaryQueriesSupport and hasSupplementaryQuerySupport instead.
 *
 * @deprecated
 */
export const hasLogsVolumeSupport = <TQuery extends DataQuery>(
  datasource: unknown
): datasource is DataSourceWithLogsVolumeSupport<TQuery> => {
  return (datasource as DataSourceWithLogsVolumeSupport<TQuery>).getLogsVolumeDataProvider !== undefined;
};
