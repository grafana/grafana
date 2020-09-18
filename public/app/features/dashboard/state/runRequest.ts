// Libraries
import { Observable, of, timer, merge, from } from 'rxjs';
import { flatten, map as lodashMap, isArray, isString } from 'lodash';
import { map, catchError, takeUntil, mapTo, share, finalize, tap } from 'rxjs/operators';
// Utils & Services
import { backendSrv } from 'app/core/services/backend_srv';
// Types
import {
  DataSourceApi,
  DataQueryRequest,
  PanelData,
  DataQueryResponse,
  DataQueryResponseData,
  DataQueryError,
  LoadingState,
  dateMath,
  toDataFrame,
  DataFrame,
  guessFieldTypes,
  DataTopic,
  KeyValue,
} from '@grafana/data';
import { toDataQueryError } from '@grafana/runtime';
import { emitDataRequestEvent } from './analyticsProcessor';
import { ExpressionDatasourceID, expressionDatasource } from 'app/features/expressions/ExpressionDatasource';
import { ExpressionQuery } from 'app/features/expressions/types';

type MapOfResponsePackets = { [str: string]: DataQueryResponse };

interface RunningQueryState {
  packets: { [key: string]: DataQueryResponse };
  panelData: PanelData;
}

/*
 * This function should handle composing a PanelData from multiple responses
 */
export function processResponsePacket(
  packet: DataQueryResponse,
  state: RunningQueryState,
  queryTopics?: KeyValue<DataTopic>
): RunningQueryState {
  const request = state.panelData.request!;
  const packets: MapOfResponsePackets = {
    ...state.packets,
  };

  packets[packet.key || 'A'] = packet;

  let loadingState = packet.state || LoadingState.Done;
  let error: DataQueryError | undefined = undefined;

  // Update the time range
  const range = { ...request.range };
  const timeRange = isString(range.raw.from)
    ? {
        from: dateMath.parse(range.raw.from, false)!,
        to: dateMath.parse(range.raw.to, true)!,
        raw: range.raw,
      }
    : range;

  const combinedData = flatten(
    lodashMap(packets, (packet: DataQueryResponse) => {
      if (packet.error) {
        loadingState = LoadingState.Error;
        error = packet.error;
      }
      if (queryTopics && packet.data) {
        return packet.data.map(f => {
          const topic = queryTopics[f.refId];
          if (topic && f.meta?.dataTopic !== topic) {
            // TODO-- savely set the topic
            console.log('SET TOPIC', f, topic);
          }
          return f;
        });
      }
      return packet.data;
    })
  );

  const panelData = {
    state: loadingState,
    series: combinedData,
    error,
    request,
    timeRange,
  };

  return { packets, panelData };
}

/**
 * a combined PanelData response.
 * It will
 *  * Merge multiple responses into a single DataFrame array based on the packet key
 *  * Will emi * This function handles the excecution of requests & and processes the single or multiple response packets into
t a loading state if no response after 50ms
 *  * Cancel any still running network requests on unsubscribe (using request.requestId)
 */
export function runRequest(datasource: DataSourceApi, request: DataQueryRequest): Observable<PanelData> {
  let state: RunningQueryState = {
    panelData: {
      state: LoadingState.Loading,
      series: [],
      request: request,
      timeRange: request.range,
    },
    packets: {},
  };

  // Return early if there are no queries to run
  if (!request.targets.length) {
    request.endTime = Date.now();
    state.panelData.state = LoadingState.Done;
    return of(state.panelData);
  }

  // Build a map of possible query targets
  let queryTopics: KeyValue<DataTopic> | undefined = undefined;
  for (const target of request.targets) {
    if (target.dataTopic) {
      if (!queryTopics) {
        queryTopics = {};
      }
      queryTopics[target.refId] = target.dataTopic;
    }
  }

  const dataObservable = callQueryMethod(datasource, request).pipe(
    // Transform response packets into PanelData with merged results
    map((packet: DataQueryResponse) => {
      if (!isArray(packet.data)) {
        throw new Error(`Expected response data to be array, got ${typeof packet.data}.`);
      }

      request.endTime = Date.now();

      state = processResponsePacket(packet, state, queryTopics);

      return state.panelData;
    }),
    // handle errors
    catchError(err => {
      console.error('runRequest.catchError', err);
      return of({
        ...state.panelData,
        state: LoadingState.Error,
        error: toDataQueryError(err),
      });
    }),
    tap(emitDataRequestEvent(datasource)),
    // finalize is triggered when subscriber unsubscribes
    // This makes sure any still running network requests are cancelled
    finalize(cancelNetworkRequestsOnUnsubscribe(request)),
    // this makes it possible to share this observable in takeUntil
    share()
  );

  // If 50ms without a response emit a loading state
  // mapTo will translate the timer event into state.panelData (which has state set to loading)
  // takeUntil will cancel the timer emit when first response packet is received on the dataObservable
  return merge(timer(200).pipe(mapTo(state.panelData), takeUntil(dataObservable)), dataObservable);
}

function cancelNetworkRequestsOnUnsubscribe(req: DataQueryRequest) {
  return () => {
    backendSrv.resolveCancelerIfExists(req.requestId);
  };
}

export function callQueryMethod(datasource: DataSourceApi, request: DataQueryRequest) {
  // If any query has an expression, use the expression endpoint
  for (const target of request.targets) {
    if (target.datasource === ExpressionDatasourceID) {
      return expressionDatasource.query(request as DataQueryRequest<ExpressionQuery>);
    }
  }

  // Otherwise it is a standard datasource request
  const returnVal = datasource.query(request);
  return from(returnVal);
}

interface PartialToptics {
  series: DataFrame[];
  annotations?: DataFrame[];
  exemplars?: DataFrame[];
}

/**
 * All panels will be passed tables that have our best guess at column type set
 *
 * This is also used by PanelChrome for snapshot support
 */
export function getProcessedDataFrames(results?: DataQueryResponseData[]): PartialToptics {
  const processed: PartialToptics = { series: [] };
  if (!isArray(results)) {
    return processed;
  }

  for (const result of results) {
    const dataFrame = guessFieldTypes(toDataFrame(result));

    if (dataFrame.fields && dataFrame.fields.length) {
      // clear out the cached info
      for (const field of dataFrame.fields) {
        field.state = null;
      }
    }

    switch (dataFrame.meta?.dataTopic) {
      case DataTopic.Annotations: {
        if (!processed.annotations) {
          processed.annotations = [dataFrame];
        } else {
          processed.annotations.push(dataFrame);
        }
        break;
      }
      case DataTopic.Exemplars: {
        if (!processed.exemplars) {
          processed.exemplars = [dataFrame];
        } else {
          processed.exemplars.push(dataFrame);
        }
        break;
      }
      default:
        processed.series.push(dataFrame);
    }
  }

  return processed;
}

export function preProcessPanelData(data: PanelData, lastResult?: PanelData): PanelData {
  const { series } = data;

  //  for loading states with no data, use last result
  if (data.state === LoadingState.Loading && series.length === 0) {
    if (!lastResult) {
      lastResult = data;
    }

    return {
      ...lastResult,
      state: LoadingState.Loading,
      request: data.request,
    };
  }

  // Make sure the data frames are properly formatted
  const STARTTIME = performance.now();
  const processed = getProcessedDataFrames(series);
  const STOPTIME = performance.now();

  return {
    ...data,
    ...processed,
    timings: { dataProcessingTime: STOPTIME - STARTTIME },
  };
}
