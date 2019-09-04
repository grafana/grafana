// Libraries
import { Observable, of, timer, merge } from 'rxjs';
import { flatten, map as lodashMap, isArray, isString } from 'lodash';
import { map, catchError, takeUntil, mapTo, share } from 'rxjs/operators';

// Utils & Services
import { LoadingState, dateMath } from '@grafana/data';

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
    map((packet: DataQueryResponsePacket) => {
      if (!isArray(packet.data)) {
        throw new Error(`Expected response data to be array, got ${typeof packet.data}.`);
      }

      request.endTime = Date.now();

      state = processResponsePacket(packet, state);
      return state.panelData;
    }),
    catchError(err =>
      of({
        ...state.panelData,
        state: LoadingState.Error,
        error: processQueryError(err),
      })
    ),
    // this makes it possible to share this observable in takeUntil
    share()
  );

  // If 50ms without a response emit a loading state
  return merge(
    timer(50).pipe(
      mapTo(state.panelData),
      takeUntil(dataObservable)
    ),
    dataObservable
  );
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
