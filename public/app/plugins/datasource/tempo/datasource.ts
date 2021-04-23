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
import { Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { LokiOptions } from '../loki/types';
import { transformTrace, transformTraceList } from './resultTransformer';

export type TempoQueryType = 'search' | undefined;

export type TempoQuery = {
  query: string;
  // Query to find list of traces, e.g., via Loki
  linkedQuery?: DataQuery;
  queryType: TempoQueryType;
} & DataQuery;

export class TempoDatasource extends DataSourceWithBackend<TempoQuery, TraceToLogsData> {
  tracesToLogs: TraceToLogsOptions;
  linkedDatasource: DataSourceApi;
  constructor(instanceSettings: DataSourceInstanceSettings<TraceToLogsData>) {
    super(instanceSettings);
    this.tracesToLogs = instanceSettings.jsonData.tracesToLogs || {};
    if (this.tracesToLogs.datasourceUid) {
      this.linkDatasource();
    }
  }

  async linkDatasource() {
    const dsSrv = getDatasourceSrv();
    this.linkedDatasource = await dsSrv.get(this.tracesToLogs.datasourceUid);
  }

  query(options: DataQueryRequest<TempoQuery>): Observable<DataQueryResponse> {
    // If there is a linked query, run that instead. This is used to provide a list of traces.
    if (options.targets.some((t) => t.linkedQuery) && this.linkedDatasource) {
      // Wrap linked query into a data request based on original request
      const linkedQuery = options.targets.find((t) => t.linkedQuery)?.linkedQuery;
      const linkedRequest: DataQueryRequest = { ...options, targets: [linkedQuery!] };
      // Find trace matcher in derived fields of the linked datasource that's identical to this datasource
      const settings: DataSourceInstanceSettings<LokiOptions> = ((this.linkedDatasource as unknown) as any)
        .instanceSettings;
      const traceLinkField = settings.jsonData.derivedFields?.find((field) => field.datasourceUid === this.uid);
      if (!traceLinkField || !traceLinkField.matcherRegex) {
        return throwError(
          'No Loki datasource configured for search. Set up Derived Field for traces in a Loki datasource settings and link it to this Tempo datasource.'
        );
      }
      return (this.linkedDatasource.query(linkedRequest) as Observable<DataQueryResponse>).pipe(
        map((response) =>
          response.error ? response : transformTraceList(response, this.uid, this.name, traceLinkField.matcherRegex)
        )
      );
    }

    return super.query(options).pipe(
      map((response) => {
        if (response.error) {
          return response;
        }
        return transformTrace(response);
      })
    );
  }

  async testDatasource(): Promise<any> {
    const response = await super.query({ targets: [{ query: '', refId: 'A' }] } as any).toPromise();

    if (!response.error?.message?.startsWith('failed to get trace')) {
      return { status: 'error', message: 'Data source is not working' };
    }

    return { status: 'success', message: 'Data source is working' };
  }

  getQueryDisplayText(query: TempoQuery) {
    return query.query;
  }
}
