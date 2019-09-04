// Libraries
import { Observable, of } from 'rxjs';
import { flatten, map as lodashMap, isArray, isString } from 'lodash';
import { map, catchError } from 'rxjs/operators';

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
    return of(state.panelData);
  }

  // Set the loading state immediatly
  state.panelData.state = LoadingState.Loading;

  if (!datasource.observe) {
    datasource.observe = wrapOldQueryMethod(datasource);
  }

  return datasource.observe(request).pipe(
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
    )
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
