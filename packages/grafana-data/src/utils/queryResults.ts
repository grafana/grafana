import { DataQueryResponse } from '../types';

/**
 * Will parse the results from `/api/ds/query
 */
export function toDataQueryResponse(res: any): DataQueryResponse {
  if (res.data) {
  }
  return { data: resultsToDataFrames(rsp) };
}

export function resultsToDataFrames(rsp: any): DataFrame[] {
  if (rsp === undefined || rsp.results === undefined) {
    return [];
  }

  const results = rsp.results as Array<{ dataframes: string[] }>;
  const frames: DataFrame[] = Object.values(results).flatMap(res => {
    if (!res.dataframes) {
      return [];
    }

    return res.dataframes.map((b: string) => arrowTableToDataFrame(base64StringToArrowTable(b)));
  });

  return frames;
}
