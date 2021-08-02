import groupBy from 'lodash/groupBy';
import {
  DataFrameView,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  LoadingState,
  MutableDataFrame,
} from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';
import { TraceToLogsOptions } from 'app/core/components/TraceToLogsSettings';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { from, merge, Observable, throwError } from 'rxjs';
import { bufferCount, map, mergeMap } from 'rxjs/operators';
import { LokiOptions, LokiQuery } from '../loki/types';
import { transformTrace, transformTraceList } from './resultTransformer';
import { PrometheusDatasource } from '../prometheus/datasource';
import { PromQuery } from '../prometheus/types';

export type TempoQueryType = 'search' | 'traceId' | 'serviceMap';

export interface TempoJsonData extends DataSourceJsonData {
  tracesToLogs?: TraceToLogsOptions;
  serviceMap?: {
    datasourceUid?: string;
  };
}

export type TempoQuery = {
  query: string;
  // Query to find list of traces, e.g., via Loki
  linkedQuery?: LokiQuery;
  queryType: TempoQueryType;
} & DataQuery;

export class TempoDatasource extends DataSourceWithBackend<TempoQuery, TempoJsonData> {
  tracesToLogs?: TraceToLogsOptions;
  serviceMap?: {
    datasourceUid?: string;
  };

  constructor(instanceSettings: DataSourceInstanceSettings<TempoJsonData>) {
    super(instanceSettings);
    this.tracesToLogs = instanceSettings.jsonData.tracesToLogs;
    this.serviceMap = instanceSettings.jsonData.serviceMap;
  }

  query(options: DataQueryRequest<TempoQuery>): Observable<DataQueryResponse> {
    const subQueries: Array<Observable<DataQueryResponse>> = [];
    const filteredTargets = options.targets.filter((target) => !target.hide);
    const targets: { [type: string]: TempoQuery[] } = groupBy(filteredTargets, (t) => t.queryType || 'traceId');

    // Run search queries on linked datasource
    if (this.tracesToLogs?.datasourceUid && targets.search?.length > 0) {
      const dsSrv = getDatasourceSrv();
      subQueries.push(
        from(dsSrv.get(this.tracesToLogs.datasourceUid)).pipe(
          mergeMap((linkedDatasource: DataSourceApi) => {
            // Wrap linked query into a data request based on original request
            const linkedRequest: DataQueryRequest = { ...options, targets: targets.search.map((t) => t.linkedQuery!) };
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

    if (this.serviceMap?.datasourceUid && targets.serviceMap?.length > 0) {
      subQueries.push(this.serviceMapQuery(options));
    }

    if (targets.traceId?.length > 0) {
      const traceRequest: DataQueryRequest<TempoQuery> = { ...options, targets: targets.traceId };
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

  private serviceMapQuery(options: DataQueryRequest<TempoQuery>) {
    return from(getDatasourceSrv().get(this.serviceMap!.datasourceUid)).pipe(
      mergeMap((ds) => {
        const promOptions: DataQueryRequest<PromQuery> = {
          ...options,
          targets: serviceMapMetrics.map((metric) => {
            return {
              refId: metric,
              expr: `delta(${metric}[$__range])`,
              instant: true,
            };
          }),
        };
        return (ds as PrometheusDatasource).query(promOptions);
      }),
      bufferCount(2),
      map((responses: DataQueryResponse[]) => {
        console.log(responses);

        const nodes = new MutableDataFrame({
          name: 'Nodes',
          fields: [{ name: 'id' }, { name: 'title' }, { name: 'mainStat' }],
          meta: {
            preferredVisualisationType: 'nodeGraph',
          },
        });

        const edges = new MutableDataFrame({
          name: 'Edges',
          fields: [{ name: 'id' }, { name: 'source' }, { name: 'target' }, { name: 'mainStat' }],
          meta: {
            preferredVisualisationType: 'nodeGraph',
          },
        });

        const totalsDF = responses.find((r) => r.data[0].refId == 'tempo_service_graph_request_total')!.data[0];
        const totalsDFView = new DataFrameView<{
          client: string;
          server: string;
          'Value #tempo_service_graph_request_total': number;
        }>(totalsDF);
        const nodesMap: Record<string, any> = {};
        const edgesMap: Record<string, any> = {};
        for (let i = 0; i < totalsDFView.length; i++) {
          const row = totalsDFView.get(i);
          const edgeId = `${row.client}_${row.server}`;
          edgesMap[edgeId] = {
            total: row['Value #tempo_service_graph_request_total'],
            target: row.server,
            source: row.client,
          };

          if (!nodesMap[row.server]) {
            nodesMap[row.server] = {
              total: row['Value #tempo_service_graph_request_total'],
            };
          } else {
            nodesMap[row.server].total += row['Value #tempo_service_graph_request_total'];
          }

          if (!nodesMap[row.client]) {
            nodesMap[row.client] = {
              total: 0,
            };
          }

        }

        for (const nodeId of Object.keys(nodesMap)) {
          const node = nodesMap[nodeId]
            nodes.fields[0].values.add(nodeId);
            nodes.fields[1].values.add(nodeId);
            nodes.fields[2].values.add(node.total);
        }

        for (const edgeId of Object.keys(edgesMap)) {
          const edge = edgesMap[edgeId]
          edges.fields[0].values.add(edgeId);
          edges.fields[1].values.add(edge.source);
          edges.fields[2].values.add(edge.target);
          edges.fields[3].values.add(edge.total);
        }

        return {
          data: [nodes, edges],
          state: LoadingState.Done,
        };
      })
    );
  }
}

const serviceMapMetrics = [
  // 'tempo_service_graph_request_seconds_bucket',
  // 'tempo_service_graph_request_seconds_count',
  'tempo_service_graph_request_seconds_sum',
  'tempo_service_graph_request_total',
  // 'tempo_service_graph_unpaired_spans_total',
  // 'tempo_service_graph_untagged_spans_total',
];
