import { DataQuery, DataQueryRequest, DataQueryResponse, DataSourceInstanceSettings } from '@grafana/data';
import { BackendSrvRequest, DataSourceWithBackend, getBackendSrv } from '@grafana/runtime';
import { TraceToLogsData, TraceToLogsOptions } from 'app/core/components/TraceToLogsSettings';
import { serializeParams } from 'app/core/utils/fetch';
import { compact, identity, pick, pickBy } from 'lodash';
import { merge, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import TempoLanguageProvider from './language_provider';
import { createTableFrameFromSearch, transformTrace } from './resultTransformer';

export type TempoQueryType = 'search' | 'traceId';

export type TempoQuery = {
  query: string;
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

    if (searchTargets.length) {
      const tags = searchTargets[0].search.split(/\s+(?=([^"]*"[^"]*")*[^"]*$)/g);
      // compact to remove empty values from array
      const tagsQuery = compact(tags).map((tag) => {
        const parts = tag.split('=');
        const extractedString = parts[1].replace(/^"(.*)"$/, '$1');
        return { [parts[0]]: extractedString };
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
