import {
  BackendSrv,
  GrafanaLiveSrv,
  LiveDataStreamOptions,
  LiveQueryDataOptions,
  toDataQueryResponse,
} from '@grafana/runtime';
import { CentrifugeSrv } from './centrifuge/service';

import { from, Observable, of, switchMap } from 'rxjs';
import {
  DataFrame,
  DataQueryResponse,
  LiveChannelAddress,
  LiveChannelEvent,
  LiveChannelPresenceStatus,
  toLiveChannelId,
} from '@grafana/data';
import {
  standardStreamOptionsProvider,
  toStreamingDataResponse,
} from '@grafana/runtime/src/utils/DataSourceWithBackend';

type GrafanaLiveServiceDeps = {
  centrifugeSrv: CentrifugeSrv;
  backendSrv: BackendSrv;
};

export class GrafanaLiveService implements GrafanaLiveSrv {
  constructor(private deps: GrafanaLiveServiceDeps) {}

  /**
   * Listen for changes to the connection state
   */
  getConnectionState(): Observable<boolean> {
    return this.deps.centrifugeSrv.getConnectionState();
  }

  /**
   * Connect to a channel and return results as DataFrames
   */
  getDataStream(options: LiveDataStreamOptions): Observable<DataQueryResponse> {
    return this.deps.centrifugeSrv.getDataStream(options);
  }

  /**
   * Watch for messages in a channel
   */
  getStream<T>(address: LiveChannelAddress): Observable<LiveChannelEvent<T>> {
    return this.deps.centrifugeSrv.getStream<T>(address);
  }

  /**
   * Execute a query over the live websocket and potentiall subscribe to a live channel.
   *
   * Since the initial request and subscription are on the same socket, this will support HA setups
   */
  getQueryData(options: LiveQueryDataOptions): Observable<DataQueryResponse> {
    return from(this.deps.centrifugeSrv.getQueryData(options)).pipe(
      switchMap((rawResponse) => {
        const parsedResponse = toDataQueryResponse(rawResponse, options.request.targets);

        const isSubscribable =
          parsedResponse.data?.length && parsedResponse.data.find((f: DataFrame) => f.meta?.channel);

        return isSubscribable
          ? toStreamingDataResponse(parsedResponse, options.request, standardStreamOptionsProvider)
          : of(parsedResponse);
      })
    );
  }
  /**
   * Publish into a channel
   *
   * @alpha -- experimental
   */
  async publish(address: LiveChannelAddress, data: any): Promise<any> {
    return this.deps.backendSrv.post(`api/live/publish`, {
      channel: toLiveChannelId(address), // orgId is from user
      data,
    });
  }

  /**
   * For channels that support presence, this will request the current state from the server.
   *
   * Join and leave messages will be sent to the open stream
   */
  async getPresence(address: LiveChannelAddress): Promise<LiveChannelPresenceStatus> {
    return this.deps.centrifugeSrv.getPresence(address);
  }
}
