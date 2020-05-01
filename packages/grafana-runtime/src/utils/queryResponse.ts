import { DataQueryResponse, arrowTableToDataFrame, base64StringToArrowTable, KeyValue } from '@grafana/data';

interface DataResponse {
  error?: string;
  refId?: string;
  dataframes?: string[];
  // series: null,
  // tables: null,
}

/**
 * Will parse the results from `/api/ds/query
 */
export function toDataQueryResponse(res: any): DataQueryResponse {
  const rsp: DataQueryResponse = { data: [] };
  if (res.data?.results) {
    const results: KeyValue = res.data.results;
    for (const refId of Object.keys(results)) {
      const dr = results[refId] as DataResponse;
      if (dr) {
        if (dr.error) {
          if (!rsp.error) {
            rsp.error = {
              refId,
              status: dr.error,
            };
          }
        }

        if (dr.dataframes) {
          for (const b64 of dr.dataframes) {
            const t = base64StringToArrowTable(b64);
            const f = arrowTableToDataFrame(t);
            if (!f.refId) {
              f.refId = refId;
            }
            rsp.data.push(f);
          }
        }
      }
    }
  }

  if (res.status && res.status !== 200) {
    console.log('ADD AN ERROR!');
  }

  return rsp;
}
