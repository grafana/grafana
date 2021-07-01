import { DataQuery, DataQueryRequest, DataQueryResponse, DataSourceInstanceSettings } from '@grafana/data';
import { BackendSrvRequest, DataSourceWithBackend, getBackendSrv } from '@grafana/runtime';
import { TraceToLogsData, TraceToLogsOptions } from 'app/core/components/TraceToLogsSettings';
import { serializeParams } from 'app/core/utils/fetch';
import { identity, pick, pickBy } from 'lodash';
import { merge, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import TempoLanguageProvider from './language_provider';
import { createTableFrameFromSearch, transformTrace } from './resultTransformer';

export type TempoQueryType = 'search' | 'traceId';

export type TempoQuery = {
  query: string;
  // Query to find list of traces, e.g., via Loki
  // linkedQuery?: DataQuery;
  search: string;
  queryType: TempoQueryType;
  minDuration?: string;
  maxDuration?: string;
  limit?: number;
} & DataQuery;

export class TempoDatasource extends DataSourceWithBackend<TempoQuery, TraceToLogsData> {
  tracesToLogs?: TraceToLogsOptions;
  languageProvider: TempoLanguageProvider;

  constructor(private instanceSettings: DataSourceInstanceSettings<TraceToLogsData>) {
    super(instanceSettings);
    this.tracesToLogs = instanceSettings.jsonData.tracesToLogs;
    this.languageProvider = new TempoLanguageProvider(this);
  }

  query(options: DataQueryRequest<TempoQuery>): Observable<DataQueryResponse> {
    const subQueries: Array<Observable<DataQueryResponse>> = [];
    const filteredTargets = options.targets.filter((target) => !target.hide);
    const searchTargets = filteredTargets.filter((target) => target.queryType === 'search');
    const traceTargets = filteredTargets.filter(
      (target) => target.queryType === 'traceId' || target.queryType === undefined
    );

    // Run search queries on linked datasource
    // if (this.tracesToLogs?.datasourceUid && searchTargets.length > 0) {
    //   const dsSrv = getDatasourceSrv();
    //   subQueries.push(
    //     from(dsSrv.get(this.tracesToLogs.datasourceUid)).pipe(
    //       mergeMap((linkedDatasource: DataSourceApi) => {
    //         // Wrap linked query into a data request based on original request
    //         const linkedRequest: DataQueryRequest = { ...options, targets: searchTargets.map((t) => t.linkedQuery!) };
    //         // Find trace matchers in derived fields of the linked datasource that's identical to this datasource
    //         const settings: DataSourceInstanceSettings<LokiOptions> = (linkedDatasource as any).instanceSettings;
    //         const traceLinkMatcher: string[] =
    //           settings.jsonData.derivedFields
    //             ?.filter((field) => field.datasourceUid === this.uid && field.matcherRegex)
    //             .map((field) => field.matcherRegex) || [];
    //         if (!traceLinkMatcher || traceLinkMatcher.length === 0) {
    //           return throwError(
    //             'No Loki datasource configured for search. Set up Derived Fields for traces in a Loki datasource settings and link it to this Tempo datasource.'
    //           );
    //         } else {
    //           return (linkedDatasource.query(linkedRequest) as Observable<DataQueryResponse>).pipe(
    //             map((response) =>
    //               response.error ? response : transformTraceList(response, this.uid, this.name, traceLinkMatcher)
    //             )
    //           );
    //         }
    //       })
    //     )
    //   );
    // }

    if (searchTargets.length) {
      const tags = searchTargets[0].search.split(' ');
      const tagsQuery = tags.map((tag) => {
        const parts = tag.split('=');
        return { [parts[0]]: parts[1] };
      });
      let tempoQuery = pick(searchTargets[0], ['minDuration', 'maxDuration', 'limit']);
      // remove empty properties
      tempoQuery = pickBy(tempoQuery, identity);
      const tagsQueryObject = tagsQuery.reduce((tagQuery, item) => ({ ...tagQuery, ...item }), {});
      subQueries.push(
        this._request('/api/search', { ...tagsQueryObject, ...tempoQuery }).pipe(
          map((response) => {
            return {
              data: [createTableFrameFromSearch(response.data.traces, this.instanceSettings)],
            };
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

  async metadataRequest(url: string, params = {}) {
    return await this._request(url, params, { method: 'GET', hideFromInspector: true }).toPromise(); // toPromise until we change getTagValues, getTagKeys to Observable
  }

  private _request(apiUrl: string, data?: any, options?: Partial<BackendSrvRequest>): Observable<Record<string, any>> {
    const params = data ? serializeParams(data) : '';
    const url = `${this.instanceSettings.url}${apiUrl}${params.length ? `?${params}` : ''}`;
    const req = {
      ...options,
      url,
    };

    return getBackendSrv().fetch(req);
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
