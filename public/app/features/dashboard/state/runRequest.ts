// Libraries
import { from, merge, Observable, of, timer } from 'rxjs';
import { flatten, isArray, isString, map as lodashMap } from 'lodash';
import { catchError, finalize, map, mapTo, share, takeUntil } from 'rxjs/operators';
// Utils & Services
import { getBackendSrv } from 'app/core/services/backend_srv';
// Types
import {
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  DataQueryResponseData,
  DataSourceApi,
  PanelData,
  PanelDataFormat,
} from '@grafana/ui';

import {
  DataFrame,
  dateMath,
  guessFieldTypes,
  isDataFrame,
  LoadingState,
  toDataFrame,
  toLegacyResponseData,
} from '@grafana/data';

// In case of only one response we just make up a dummy key
const DUMMY_KEY = 'A';

type MapOfResponsePackets = { [str: string]: DataQueryResponse };

interface RunningQueryState {
  packets: { [key: string]: DataQueryResponse };
  panelData: PanelData;
}

/*
 * This function should handle composing a PanelData from multiple responses
 */
export function processResponsePacket(packet: DataQueryResponse, state: RunningQueryState): RunningQueryState {
  const request = state.panelData.request;
  const packets: MapOfResponsePackets = {
    ...state.packets,
  };

  packets[packet.key || DUMMY_KEY] = packet;

  // Update the time range
  let timeRange = request.range;
  if (isString(timeRange.raw.from)) {
    timeRange = {
      from: dateMath.parse(timeRange.raw.from, false),
      to: dateMath.parse(timeRange.raw.to, true),
      raw: timeRange.raw,
    };
  }

  const combinedData = flatten(
    lodashMap(packets, (packet: DataQueryResponse) => {
      return packet.data;
    })
  );

  // In packets we only have data from requests that already returned some data. We could prefill them with some
  // initial value, but we do not know the key of returned packet from the request so we would not be able to match
  // the packet to the initialised dummy values.
  const packetStates = Object.values(packets).map(p => p.state);
  if (packetStates.length < request.targets.length) {
    packetStates.push(...new Array(request.targets.length - packetStates.length).fill(LoadingState.Loading));
  }

  const panelData = {
    state: getCombinedState(packetStates),
    series: combinedData,
    request: {
      ...request,
      range: timeRange,
    },
  };

  return { packets, panelData };
}

function getCombinedState(states: LoadingState[]) {
  if (states.includes(LoadingState.Error)) {
    return LoadingState.Error;
  }

  if (states.includes(LoadingState.Streaming)) {
    return LoadingState.Streaming;
  }

  if (states.includes(LoadingState.Loading)) {
    return LoadingState.Loading;
  }
  if (states.filter(s => s !== LoadingState.Done).length === 0) {
    return LoadingState.Done;
  }
  if (states.filter(s => s !== LoadingState.NotStarted).length === 0) {
    return LoadingState.NotStarted;
  }
  // This should only a case when there are some Done and some NotStarted. Not sure if that's real possibility
  return LoadingState.Loading;
}

/**
 * This function handles the excecution of requests & and processes the single or multiple response packets into
 * a combined PanelData response.
 * It will
 *  * Merge multiple responses into a single DataFrame array based on the packet key
 *  * Will emit a loading state if no response after 50ms
 *  * Cancel any still runnning network requests on unsubscribe (using request.requestId)
 */
export function runRequest(datasource: DataSourceApi, request: DataQueryRequest): Observable<PanelData> {
  let state: RunningQueryState = {
    panelData: {
      state: LoadingState.Loading,
      series: [],
      request: request,
    },
    packets: {
      C: {
        state: LoadingState.Loading,
        data: [],
      },
    },
  };

  // Return early if there are no queries to run
  if (!request.targets.length) {
    request.endTime = Date.now();
    state.panelData.state = LoadingState.Done;
    return of(state.panelData);
  }

  const dataObservable = callQueryMethod(datasource, request).pipe(
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
    catchError(err =>
      of({
        ...state.panelData,
        state: LoadingState.Error,
        error: processQueryError(err),
      })
    ),
    // finalize is triggered when subscriber unsubscribes
    // This makes sure any still running network requests are cancelled
    finalize(cancelNetworkRequestsOnUnsubscribe(request)),
    // this makes it possible to share this observable in takeUntil
    share()
  );

  // If 50ms without a response emit a loading state
  // mapTo will translate the timer event into state.panelData (which has state set to loading)
  // takeUntil will cancel the timer emit when first response packet is received on the dataObservable
  return merge(
    timer(200).pipe(
      mapTo(state.panelData),
      takeUntil(dataObservable)
    ),
    dataObservable
  );
}

function cancelNetworkRequestsOnUnsubscribe(req: DataQueryRequest) {
  return () => {
    getBackendSrv().resolveCancelerIfExists(req.requestId);
  };
}

export function callQueryMethod(datasource: DataSourceApi, request: DataQueryRequest) {
  const returnVal = datasource.query(request);
  return from(returnVal);
}

export function processQueryError(err: any): DataQueryError {
  const error = (err || {}) as DataQueryError;

  if (!error.message) {
    if (typeof err === 'string' || err instanceof String) {
      return { message: err } as DataQueryError;
    }

    let message = 'Query error';
    if (error.message) {
      message = error.message;
    } else if (error.data && error.data.message) {
      message = error.data.message;
    } else if (error.data && error.data.error) {
      message = error.data.error;
    } else if (error.status) {
      message = `Query error: ${error.status} ${error.statusText}`;
    }
    error.message = message;
  }

  return error;
}

function translateToLegacyData(data: DataQueryResponseData) {
  return data.map((v: any) => {
    if (isDataFrame(v)) {
      return toLegacyResponseData(v);
    }
    return v;
  });
}

/**
 * All panels will be passed tables that have our best guess at colum type set
 *
 * This is also used by PanelChrome for snapshot support
 */
export function getProcessedDataFrames(results?: DataQueryResponseData[]): DataFrame[] {
  if (!isArray(results)) {
    return [];
  }

  const dataFrames: DataFrame[] = [];

  for (const result of results) {
    const dataFrame = guessFieldTypes(toDataFrame(result));

    // clear out any cached calcs
    for (const field of dataFrame.fields) {
      field.calcs = null;
    }

    dataFrames.push(dataFrame);
  }

  return dataFrames;
}

export function postProcessPanelData(format: PanelDataFormat) {
  let lastResult: PanelData = null;

  return function mapper(data: PanelData) {
    let { series, legacy } = data;

    //  for loading states with no data, use last result
    if (data.state === LoadingState.Loading && series.length === 0) {
      if (!lastResult) {
        lastResult = data;
      }

      return { ...lastResult, state: LoadingState.Loading };
    }

    if (format & PanelDataFormat.Legacy) {
      legacy = translateToLegacyData(series);
    }

    if (format & PanelDataFormat.Frames) {
      series = getProcessedDataFrames(series);
    }

    lastResult = { ...data, series, legacy };
    return lastResult;
  };
}
