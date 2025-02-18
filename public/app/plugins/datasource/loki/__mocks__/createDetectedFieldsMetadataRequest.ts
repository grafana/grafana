import { DetectedFieldsResult } from '../types';

export function createDetectedFieldsMetadataRequest(response: DetectedFieldsResult) {
  const lokiLabelsAndValuesEndpointRegex = /^detected_fields/;

  return async function metadataRequestMock(url: string) {
    const labelsMatch = url.match(lokiLabelsAndValuesEndpointRegex);
    if (labelsMatch) {
      return response ?? {};
    } else {
      throw new Error(`Unexpected url error, ${url}`);
    }
  };
}
