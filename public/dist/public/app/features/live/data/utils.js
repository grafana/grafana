import { isDataFrame } from '@grafana/data';
/**
 * @alpha -- experimental
 */
export var StreamingResponseDataType;
(function (StreamingResponseDataType) {
    StreamingResponseDataType["NewValuesSameSchema"] = "NewValuesSameSchema";
    StreamingResponseDataType["FullFrame"] = "FullFrame";
})(StreamingResponseDataType || (StreamingResponseDataType = {}));
/**
 * @alpha -- experimental
 */
export const isStreamingResponseData = (responseData, type) => 'type' in responseData && responseData.type === type;
const AllStreamingResponseDataTypes = Object.values(StreamingResponseDataType);
/**
 * @alpha -- experimental
 */
export const isAnyStreamingResponseData = (responseData) => 'type' in responseData && AllStreamingResponseDataTypes.includes(responseData.type);
/**
 * @alpha -- experimental
 */
export const isStreamingDataFrame = (data) => isDataFrame(data) && 'packetInfo' in data;
//# sourceMappingURL=utils.js.map