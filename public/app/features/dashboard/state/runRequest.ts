// Libraries
import { Observable, of, timer, merge } from 'rxjs';
import { flatten, map as lodashMap, isArray, isString } from 'lodash';
import { map, catchError, takeUntil, mapTo, share, finalize } from 'rxjs/operators';

// Utils & Services
import { LoadingState, dateMath } from '@grafana/data';
import { getBackendSrv } from 'app/core/services/backend_srv';

// Types
import { DataSourceApi, DataQueryRequest, PanelData, DataQueryResponsePacket, DataQueryError } from '@grafana/ui';

type MapOfResponsePackets = { [str: string]: DataQueryResponsePacket };

interface RunningQueryState {
  packets: { [key: string]: DataQueryResponsePacket };
  panelData: PanelData;
}

/*
 * This function should handle composing a PanelData from multiple responses
 * Does not handle deltas yet
 */
export function processResponsePacket(packet: DataQueryResponsePacket, state: RunningQueryState): RunningQueryState {
  const request = state.panelData.request;
  const packets: MapOfResponsePackets = {
    ...state.packets,
  };

  packets[packet.key || 'A'] = packet;

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
    lodashMap(packets, (packet: DataQueryResponsePacket) => {
      return packet.data;
    })
  );

  const panelData = {
    state: LoadingState.Done,
    series: combinedData,
    request: {
      ...request,
      range: timeRange,
    },
  };

  return { packets, panelData };
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
    packets: {},
  };

  // Return early if there are no queries to run
  if (!request.targets.length) {
    request.endTime = Date.now();
    state.panelData.state = LoadingState.Done;
    return of(state.panelData);
  }

  if (!datasource.observe) {
    datasource.observe = wrapOldQueryMethod(datasource);
  }

  const dataObservable = datasource.observe(request).pipe(
    // Transform response packets into PanelData with merged results
    map((packet: DataQueryResponsePacket) => {
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
    // finalize is triggered subscriber unsubscribes
    // This makes sure any still running network requests are cancelled
    finalize(cancelNetworkRequestsOnUnsubscribe(request)),
    // this makes it possible to share this observable in takeUntil
    share()
  );

  // If 50ms without a response emit a loading state
  // mapTo will translate the timer event into state.panelData (which has state set to loading)
  // takeUntil will cancel the timer emit when first response packet is received on the dataObservable
  return merge(
    timer(50).pipe(
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

export function wrapOldQueryMethod(datasource: DataSourceApi) {
  return (req: DataQueryRequest) => {
    return new Observable<DataQueryResponsePacket>(subscriber => {
      datasource
        .query(req)
        .then(resp => {
          subscriber.next({
            data: resp.data,
            key: 'A',
          });
        })
        .catch(err => {
          subscriber.error(err);
        });
    });
  };
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
