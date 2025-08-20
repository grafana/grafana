export function createMetadataRequest(
  labelsAndValues: Record<string, string[]>,
  series?: Record<string, Array<Record<string, string>>>
) {
  // added % to allow urlencoded labelKeys. Note, that this is not confirm with Loki, as loki does not allow specialcharacters in labelKeys, but needed for tests.
  const lokiLabelsAndValuesEndpointRegex = /^label\/([%\w]*)\/values/;
  const lokiSeriesEndpointRegex = /^series/;
  const lokiLabelsEndpoint = 'labels';
  const labels = Object.keys(labelsAndValues);

  return async function metadataRequestMock(url: string, params?: Record<string, string | number>) {
    if (url === lokiLabelsEndpoint) {
      return labels;
    } else {
      const labelsMatch = url.match(lokiLabelsAndValuesEndpointRegex);
      const seriesMatch = url.match(lokiSeriesEndpointRegex);
      if (labelsMatch) {
        if (series && params && params['query']) {
          const labelAndValue = series[params['query'] as string];
          return labelAndValue.map((s) => s[labelsMatch[1]]) || [];
        } else {
          return labelsAndValues[labelsMatch[1]] || [];
        }
      } else if (seriesMatch && series && params) {
        return series[params['match[]']] || [];
      } else {
        throw new Error(`Unexpected url error, ${url}`);
      }
    }
  };
}
