import {
  DataQueryResponse,
  isLiveChannelMessageEvent,
  isLiveChannelStatusEvent,
  isValidLiveChannelAddress,
  LiveChannelAddress,
  LoadingState,
} from '@grafana/data';
import { LiveMeasurements, MeasurementsQuery } from './types';
import { getGrafanaLiveSrv } from '../services/live';

import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * @alpha -- experimental
 */
export function getLiveMeasurements(addr: LiveChannelAddress): LiveMeasurements | undefined {
  if (!isValidLiveChannelAddress(addr)) {
    return undefined;
  }

  const live = getGrafanaLiveSrv();
  if (!live) {
    return undefined;
  }

  const channel = live.getChannel<LiveMeasurements>(addr);
  const getController = channel?.config?.getController;
  return getController ? getController() : undefined;
}

/**
 * When you know the stream will be managed measurements
 *
 * @alpha -- experimental
 */
export function getLiveMeasurementsObserver(
  addr: LiveChannelAddress,
  requestId: string,
  query?: MeasurementsQuery
): Observable<DataQueryResponse> {
  const rsp: DataQueryResponse = { data: [] };
  if (!addr || !addr.path) {
    return of(rsp); // Address not configured yet
  }

  const live = getGrafanaLiveSrv();
  if (!live) {
    // This will only happen with the feature flag is not enabled
    rsp.error = { message: 'Grafana live is not initalized' };
    return of(rsp);
  }

  rsp.key = requestId;
  return live
    .getChannel<LiveMeasurements>(addr)
    .getStream()
    .pipe(
      map(evt => {
        if (isLiveChannelMessageEvent(evt)) {
          rsp.data = evt.message.getData(query);
          if (!rsp.data.length) {
            // ?? skip when data is empty ???
          }
          delete rsp.error;
          rsp.state = LoadingState.Streaming;
        } else if (isLiveChannelStatusEvent(evt)) {
          if (evt.error != null) {
            rsp.error = rsp.error;
            rsp.state = LoadingState.Error;
          }
        }
        return { ...rsp }; // send event on all status messages
      })
    );
}
