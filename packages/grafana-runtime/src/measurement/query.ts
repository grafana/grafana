import {
  DataQueryResponse,
  isLiveChannelMessageEvent,
  isLiveChannelStatusEvent,
  LiveChannelAddress,
  LoadingState,
} from '@grafana/data';
import { LiveMeasurements, MeasurementsQuery } from './types';
import { getGrafanaLiveSrv } from '../services/live';

import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * When you know the stream will be managed measurments
 */
export function getLiveMeasurmentsObserver(
  requestId: string,
  addr: LiveChannelAddress,
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

  rsp.state = LoadingState.Streaming;
  rsp.key = requestId;
  return live
    .getChannel<LiveMeasurements>(addr)
    .getStream()
    .pipe(
      map(evt => {
        if (isLiveChannelMessageEvent(evt)) {
          rsp.data = evt.message.getData(query);
          delete rsp.error;
        } else if (isLiveChannelStatusEvent(evt)) {
          rsp.error = evt.error;
        }
        console.log('EVENT', addr.path, rsp);
        return { ...rsp }; // send event on all status messages
      })
    );
}
