import {
  DataFrame,
  DataQueryError,
  DataQueryResponseData,
  isDataFrame,
  LiveChannelAddress,
  LiveChannelEvent,
  LiveChannelPresenceStatus,
  LoadingState,
  StreamingDataFrame,
  StreamingFrameOptions,
} from '@grafana/data';
import { Observable } from 'rxjs';

/**
 * @alpha -- experimental
 */
export interface LiveDataFilter {
  fields?: string[];
}

/**
 * @alpha
 */
export interface LiveDataStreamOptions {
  addr: LiveChannelAddress;
  frame?: DataFrame; // initial results
  key?: string;
  buffer?: StreamingFrameOptions;
  filter?: LiveDataFilter;
}

/**
 * @alpha -- experimental
 */
export enum StreamingResponseDataType {
  NewValuesSameSchema = 'NewValuesSameSchema',
  FullFrame = 'FullFrame',
}

/**
 * @alpha -- experimental
 */
export type StreamingResponseDataTypeToData = {
  [StreamingResponseDataType.NewValuesSameSchema]: {
    values: unknown[][];
  };
  [StreamingResponseDataType.FullFrame]: {
    frame: ReturnType<StreamingDataFrame['serialize']>;
  };
};

/**
 * @alpha -- experimental
 */
export type StreamingResponseData<T = StreamingResponseDataType> = T extends StreamingResponseDataType
  ? {
      type: T;
    } & StreamingResponseDataTypeToData[T]
  : never;

/**
 * @alpha -- experimental
 */
export const isStreamingResponseData = <T extends StreamingResponseDataType>(
  responseData: DataQueryResponseData,
  type: T
): responseData is StreamingResponseData<T> => 'type' in responseData && responseData.type === type;

const AllStreamingResponseDataTypes = Object.values(StreamingResponseDataType);

/**
 * @alpha -- experimental
 */
export const isAnyStreamingResponseData = (
  responseData: DataQueryResponseData
): responseData is StreamingResponseData =>
  'type' in responseData && AllStreamingResponseDataTypes.includes(responseData.type);

/**
 * @alpha -- experimental
 */
export const isStreamingDataFrame = (data: DataQueryResponseData): data is StreamingDataFrame =>
  isDataFrame(data) && 'packetInfo' in data;

/**
 * @alpha -- experimental
 */
export type StreamingDataQueryResponse = {
  /**
   * The response data.  When streaming, this may be empty
   * or a partial result set
   */
  data: [StreamingResponseData];

  /**
   * Unique subscription key
   */
  key: string;

  /**
   * Optionally include error info along with the response data
   */
  error?: DataQueryError;

  /**
   * Use this to control which state the response should have
   * Defaults to LoadingState.Done if state is not defined
   */
  state: LoadingState;
};

/**
 * @alpha -- experimental
 */
export interface GrafanaLiveSrv {
  /**
   * Listen for changes to the main service
   */
  getConnectionState(): Observable<boolean>;

  /**
   * Watch for messages in a channel
   */
  getStream<T>(address: LiveChannelAddress): Observable<LiveChannelEvent<T>>;

  /**
   * Connect to a channel and return results as DataFrames
   */
  getDataStream(options: LiveDataStreamOptions): Observable<StreamingDataQueryResponse>;

  /**
   * For channels that support presence, this will request the current state from the server.
   *
   * Join and leave messages will be sent to the open stream
   */
  getPresence(address: LiveChannelAddress): Promise<LiveChannelPresenceStatus>;

  /**
   * Publish into a channel
   *
   * @alpha -- experimental
   */
  publish(address: LiveChannelAddress, data: any): Promise<any>;
}

let singletonInstance: GrafanaLiveSrv;

/**
 * Used during startup by Grafana to set the GrafanaLiveSrv so it is available
 * via the {@link getGrafanaLiveSrv} to the rest of the application.
 *
 * @internal
 */
export const setGrafanaLiveSrv = (instance: GrafanaLiveSrv) => {
  singletonInstance = instance;
};

/**
 * Used to retrieve the GrafanaLiveSrv that allows you to subscribe to
 * server side events and streams
 *
 * @alpha -- experimental
 */
export const getGrafanaLiveSrv = (): GrafanaLiveSrv => singletonInstance;
