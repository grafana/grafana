import {
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
} from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';
import { TraceToLogsData, TraceToLogsOptions } from 'app/core/components/TraceToLogsSettings';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { from, merge, Observable, throwError } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { LokiOptions } from '../loki/types';
import { transformTrace, transformTraceList } from './resultTransformer';

export type TempoQueryType = 'search' | 'traceId';

export type TempoQuery = {
  query: string;
  // Query to find list of traces, e.g., via Loki
  linkedQuery?: DataQuery;
  queryType: TempoQueryType;
} & DataQuery;

export class TempoDatasource extends DataSourceWithBackend<TempoQuery, TraceToLogsData> {
  tracesToLogs?: TraceToLogsOptions;

  constructor(instanceSettings: DataSourceInstanceSettings<TraceToLogsData>) {
    super(instanceSettings);
    this.tracesToLogs = instanceSettings.jsonData.tracesToLogs;
  }

  query(options: DataQueryRequest<TempoQuery>): Observable<DataQueryResponse> {
    const subQueries: Array<Observable<DataQueryResponse>> = [];
    const filteredTargets = options.targets.filter((target) => !target.hide);
    const searchTargets = filteredTargets.filter((target) => target.queryType === 'search');
    const traceTargets = filteredTargets.filter(
      (target) => target.queryType === 'traceId' || target.queryType === undefined
    );

    // Run search queries on linked datasource
    if (this.tracesToLogs?.datasourceUid && searchTargets.length > 0) {
      const dsSrv = getDatasourceSrv();
      subQueries.push(
        from(dsSrv.get(this.tracesToLogs.datasourceUid)).pipe(
          mergeMap((linkedDatasource: DataSourceApi) => {
            // Wrap linked query into a data request based on original request
            const linkedRequest: DataQueryRequest = { ...options, targets: searchTargets.map((t) => t.linkedQuery!) };
            // Find trace matchers in derived fields of the linked datasource that's identical to this datasource
            const settings: DataSourceInstanceSettings<LokiOptions> = (linkedDatasource as any).instanceSettings;
            const traceLinkMatcher: string[] =
              settings.jsonData.derivedFields
                ?.filter((field) => field.datasourceUid === this.uid && field.matcherRegex)
                .map((field) => field.matcherRegex) || [];
            if (!traceLinkMatcher || traceLinkMatcher.length === 0) {
              return throwError(
                'No Loki datasource configured for search. Set up Derived Fields for traces in a Loki datasource settings and link it to this Tempo datasource.'
              );
            } else {
              return (linkedDatasource.query(linkedRequest) as Observable<DataQueryResponse>).pipe(
                map((response) =>
                  response.error ? response : transformTraceList(response, this.uid, this.name, traceLinkMatcher)
                )
              );
            }
          })
        )
      );
    }

    if (traceTargets.length > 0) {
      const traceRequest: DataQueryRequest<TempoQuery> = { ...options, targets: traceTargets };
      subQueries.push(
        super.query(traceRequest).pipe(
          map((response) => {
            if (response.error) {
              return response;
            }
            return transformTrace(response);
          })
        )
      );
    }

    return merge(...subQueries);
  }

  async testDatasource(): Promise<any> {
    // to test Tempo we send a dummy traceID and verify Tempo answers with 'trace not found'
    const response = await super.query({ targets: [{ query: '0' }] } as any).toPromise();

    const errorMessage = response.error?.message;
    if (
      errorMessage &&
      errorMessage.startsWith('failed to get trace') &&
      errorMessage.endsWith('trace not found in Tempo')
    ) {
      return { status: 'success', message: 'Data source is working' };
    }

    return { status: 'error', message: 'Data source is not working' + (errorMessage ? `: ${errorMessage}` : '') };
  }

  getQueryDisplayText(query: TempoQuery) {
    return query.query;
  }
}
