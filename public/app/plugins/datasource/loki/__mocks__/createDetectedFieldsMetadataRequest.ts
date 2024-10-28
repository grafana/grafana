export function createDetectedFieldsMetadataRequest(labelsAndValues: string[]) {
  // @todo ??
  // added % to allow urlencoded labelKeys. Note, that this is not confirm with Loki, as loki does not allow specialcharacters in labelKeys, but needed for tests.
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
