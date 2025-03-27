export function createDetectedFieldValuesMetadataRequest(labelsAndValues: string[]) {
  const lokiLabelsAndValuesEndpointRegex = /^detected_field\/([%\w]*)\/values/;

  return async function metadataRequestMock(url: string) {
    const labelsMatch = url.match(lokiLabelsAndValuesEndpointRegex);
    if (labelsMatch) {
      return labelsAndValues ?? [];
    } else {
      throw new Error(`Unexpected url error, ${url}`);
    }
  };
}
