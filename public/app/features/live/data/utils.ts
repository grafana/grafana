import { DataQueryResponseData, isDataFrame } from '@grafana/data';
import { StreamingDataFrame } from './StreamingDataFrame';

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
