// Libraries
import { isString, map as isArray } from 'lodash';
import { from, merge, Observable, of, timer } from 'rxjs';
import { catchError, map, mapTo, share, takeUntil, tap } from 'rxjs/operators';

// Utils & Services
// Types
import {
  DataFrame,
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  DataQueryResponseData,
  DataSourceApi,
  DataTopic,
  dateMath,
  guessFieldTypes,
  LoadingState,
  PanelData,
  TimeRange,
  toDataFrame,
} from '@grafana/data';
import { toDataQueryError } from '@grafana/runtime';
import { isExpressionReference } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { backendSrv } from 'app/core/services/backend_srv';
import { dataSource as expressionDatasource } from 'app/features/expressions/ExpressionDatasource';
import { ExpressionQuery } from 'app/features/expressions/types';

import { cancelNetworkRequestsOnUnsubscribe } from './processing/canceler';
import { emitDataRequestEvent } from './queryAnalytics';

type MapOfResponsePackets = { [str: string]: DataQueryResponse };

interface RunningQueryState {
  packets: { [key: string]: DataQueryResponse };
  panelData: PanelData;
}

/*
 * This function should handle composing a PanelData from multiple responses
 */
export function processResponsePacket(packet: DataQueryResponse, state: RunningQueryState): RunningQueryState {
  const request = state.panelData.request!;
  const packets: MapOfResponsePackets = {
    ...state.packets,
  };

  // updates to the same key will replace previous values
  const key = packet.key ?? packet.data?.[0]?.refId ?? 'A';
  packets[key] = packet;

  let loadingState = packet.state || LoadingState.Done;
  let error: DataQueryError | undefined = undefined;

  const series: DataQueryResponseData[] = [];
  const annotations: DataQueryResponseData[] = [];

  for (const key in packets) {
    const packet = packets[key];

    if (packet.error) {
      loadingState = LoadingState.Error;
      error = packet.error;
    }

    if (packet.data && packet.data.length) {
      for (const dataItem of packet.data) {
        if (dataItem.meta?.dataTopic === DataTopic.Annotations) {
          annotations.push(dataItem);
          continue;
        }

        series.push(dataItem);
      }
    }
  }

  const timeRange = getRequestTimeRange(request, loadingState);

  const panelData = {
    state: loadingState,
    series,
    annotations,
    error,
    request,
    timeRange,
  };

  return { packets, panelData };
}

function getRequestTimeRange(request: DataQueryRequest, loadingState: LoadingState): TimeRange {
  const range = request.range;

  if (!isString(range.raw.from) || loadingState !== LoadingState.Streaming) {
    return range;
  }

  return {
    ...range,
    from: dateMath.parse(range.raw.from, false)!,
    to: dateMath.parse(range.raw.to, true)!,
  };
}

/**
 * This function handles the execution of requests & and processes the single or multiple response packets into
 * a combined PanelData response. It will
 *  Merge multiple responses into a single DataFrame array based on the packet key
 *  Will emit a loading state if no response after 50ms
 *  Cancel any still running network requests on unsubscribe (using request.requestId)
 */
export function runRequest(
  datasource: DataSourceApi,
  request: DataQueryRequest,
  queryFunction?: typeof datasource.query
): Observable<PanelData> {
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

  const dataObservable = callQueryMethod(datasource, request, queryFunction).pipe(
    // Transform response packets into PanelData with merged results
    map((packet: DataQueryResponse) => {
      if (!isArray(packet.data)) {
        throw new Error(`Expected response data to be array, got ${typeof packet.data}.`);
      }

      request.endTime = Date.now();

      state = processResponsePacket(packet, state);

      return state.panelData;
    }),
    // handle errors
    catchError((err) => {
      const errLog = typeof err === 'string' ? err : JSON.stringify(err);
      console.error('runRequest.catchError', errLog);
      return of({
        ...state.panelData,
        state: LoadingState.Error,
        error: toDataQueryError(err),
      });
    }),
    tap(emitDataRequestEvent(datasource)),
    // finalize is triggered when subscriber unsubscribes
    // This makes sure any still running network requests are cancelled
    cancelNetworkRequestsOnUnsubscribe(backendSrv, request.requestId),
    // this makes it possible to share this observable in takeUntil
    share()
  );

  // If 50ms without a response emit a loading state
  // mapTo will translate the timer event into state.panelData (which has state set to loading)
  // takeUntil will cancel the timer emit when first response packet is received on the dataObservable
  return merge(timer(200).pipe(mapTo(state.panelData), takeUntil(dataObservable)), dataObservable);
}

export function callQueryMethod(
  datasource: DataSourceApi,
  request: DataQueryRequest,
  queryFunction?: typeof datasource.query
) {
  // If its a public datasource, just return the result. Expressions will be handled on the backend.
  if (datasource.type === 'public-ds') {
    return from(datasource.query(request));
  }

  for (const target of request.targets) {
    if (isExpressionReference(target.datasource)) {
      return expressionDatasource.query(request as DataQueryRequest<ExpressionQuery>);
    }
  }

  // Otherwise it is a standard datasource request
  const returnVal = queryFunction ? queryFunction(request) : datasource.query(request);
  return from(returnVal);
}

function getProcessedDataFrame(data: DataQueryResponseData): DataFrame {
  const dataFrame = guessFieldTypes(toDataFrame(data));

  if (dataFrame.fields && dataFrame.fields.length) {
    // clear out the cached info
    for (const field of dataFrame.fields) {
      field.state = null;
    }
  }

  return dataFrame;
}

/**
 * All panels will be passed tables that have our best guess at column type set
 *
 * This is also used by PanelChrome for snapshot support
 */
export function getProcessedDataFrames(results?: DataQueryResponseData[]): DataFrame[] {
  if (!results || !isArray(results)) {
    return [];
  }

  return results.map((data) => getProcessedDataFrame(data));
}

export function preProcessPanelData(data: PanelData, lastResult?: PanelData): PanelData {
  const { series, annotations } = data;

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
  const processedDataFrames = series.map((data) => getProcessedDataFrame(data));
  const annotationsProcessed = getProcessedDataFrames(annotations);
  const STOPTIME = performance.now();

  return {
    ...data,
    series: processedDataFrames,
    annotations: annotationsProcessed,
    timings: { dataProcessingTime: STOPTIME - STARTTIME },
  };
}
