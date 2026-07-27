import { type DataQueryResponseData, isDataFrame, type StreamingDataFrame } from '@grafana/data';

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
type StreamingResponseDataTypeToData = {
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

/**
 * @alpha -- experimental
 */
export const isStreamingDataFrame = (data: DataQueryResponseData): data is StreamingDataFrame =>
  isDataFrame(data) && 'packetInfo' in data;
