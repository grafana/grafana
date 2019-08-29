// Libraries
import { Observable, of } from 'rxjs';
import { flatten, map as lodashMap, isArray } from 'lodash';
import { map } from 'rxjs/operators';

// Utils & Services
import { LoadingState, toDataFrame } from '@grafana/data';

// Types
import { DataSourceApi, DataQueryRequest, PanelData, DataQueryResponsePacket } from '@grafana/ui';

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
  const packets: MapOfResponsePackets = {
    ...state.packets,
  };

  packets[packet.key || 'A'] = packet;

  const panelData = {
    state: LoadingState.Done,
    series: flatten(
      lodashMap(packets, (packet: DataQueryResponsePacket) => {
        return packet.data.map(v => toDataFrame(v));
      })
    ),
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
    return null;
  }

  return datasource.observe(request).pipe(
    map((packet: DataQueryResponsePacket) => {
      if (!isArray(packet.data)) {
        throw new Error(`Expected response data to be array, got ${typeof packet.data}.`);
      }

      request.endTime = Date.now();

      state = processResponsePacket(packet, state);
      return state.panelData;
    })
  );
}

// export function toDataQueryError(err: any): DataQueryError {
//   const error = (err || {}) as DataQueryError;
//   if (!error.message) {
//     if (typeof err === 'string' || err instanceof String) {
//       return { message: err } as DataQueryError;
//     }
//
//     let message = 'Query error';
//     if (error.message) {
//       message = error.message;
//     } else if (error.data && error.data.message) {
//       message = error.data.message;
//     } else if (error.data && error.data.error) {
//       message = error.data.error;
//     } else if (error.status) {
//       message = `Query error: ${error.status} ${error.statusText}`;
//     }
//     error.message = message;
//   }
//   return error;
// }
//
// function translateToLegacyData(data: DataQueryResponseData) {
//   return data.map((v: any) => {
//     if (isDataFrame(v)) {
//       return toLegacyResponseData(v);
//     }
//     return v;
//   });
// }
//
// /**
//  * All panels will be passed tables that have our best guess at colum type set
//  *
//  * This is also used by PanelChrome for snapshot support
//  */
// export function getProcessedDataFrames(results?: DataQueryResponseData[]): DataFrame[] {
//   if (!isArray(results)) {
//     return [];
//   }
//
//   const series: DataFrame[] = [];
//   for (const r of results) {
//     if (r) {
//       series.push(guessFieldTypes(toDataFrame(r)));
//     }
//   }
//
//   return series;
// }
