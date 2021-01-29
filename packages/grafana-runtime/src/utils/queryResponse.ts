import {
  DataQueryResponse,
  arrowTableToDataFrame,
  base64StringToArrowTable,
  KeyValue,
  LoadingState,
  DataQueryError,
  TimeSeries,
  TableData,
  toDataFrame,
  DataFrame,
  MetricFindValue,
  FieldType,
  DataQuery,
} from '@grafana/data';

interface DataResponse {
  error?: string;
  refId?: string;
  dataframes?: string[];
  series?: TimeSeries[];
  tables?: TableData[];
}

/**
 * Parse the results from /api/ds/query into a DataQueryResponse
 *
 * @param res - the HTTP response data.
 * @param queries - optional DataQuery array that will order the response based on the order of query refId's.
 *
 * @public
 */
export function toDataQueryResponse(res: any, queries?: DataQuery[]): DataQueryResponse {
  const rsp: DataQueryResponse = { data: [], state: LoadingState.Done };
  if (res.data?.results) {
    const results: KeyValue = res.data.results;
    const resultIDs = Object.keys(results);
    const refIDs = queries ? queries.map((q) => q.refId) : resultIDs;
    const usedResultIDs = new Set<string>(resultIDs);
    const data: DataResponse[] = [];

    for (const refId of refIDs) {
      const dr = results[refId] as DataResponse;
      if (!dr) {
        continue;
      }
      dr.refId = refId;
      usedResultIDs.delete(refId);
      data.push(dr);
    }

    // Add any refIds that do not match the query targets
    if (usedResultIDs.size) {
      for (const refId of usedResultIDs) {
        const dr = results[refId] as DataResponse;
        if (!dr) {
          continue;
        }
        dr.refId = refId;
        usedResultIDs.delete(refId);
        data.push(dr);
      }
    }

    for (const dr of data) {
      if (dr.error) {
        if (!rsp.error) {
          rsp.error = {
            refId: dr.refId,
            message: dr.error,
          };
          rsp.state = LoadingState.Error;
        }
      }

      if (dr.series?.length) {
        for (const s of dr.series) {
          if (!s.refId) {
            s.refId = dr.refId;
          }
          rsp.data.push(toDataFrame(s));
        }
      }

      if (dr.tables?.length) {
        for (const s of dr.tables) {
          if (!s.refId) {
            s.refId = dr.refId;
          }
          rsp.data.push(toDataFrame(s));
        }
      }

      if (dr.dataframes) {
        for (const b64 of dr.dataframes) {
          try {
            const t = base64StringToArrowTable(b64);
            const f = arrowTableToDataFrame(t);
            if (!f.refId) {
              f.refId = dr.refId;
            }
            rsp.data.push(f);
          } catch (err) {
            rsp.state = LoadingState.Error;
            rsp.error = toDataQueryError(err);
          }
        }
      }
    }
  }

  // When it is not an OK response, make sure the error gets added
  if (res.status && res.status !== 200) {
    if (rsp.state !== LoadingState.Error) {
      rsp.state = LoadingState.Error;
    }
    if (!rsp.error) {
      rsp.error = toDataQueryError(res);
    }
  }

  return rsp;
}

/**
 * Convert an object into a DataQueryError -- if this is an HTTP response,
 * it will put the correct values in the error field
 *
 * @public
 */
export function toDataQueryError(err: any): DataQueryError {
  const error = (err || {}) as DataQueryError;

  if (!error.message) {
    if (typeof err === 'string' || err instanceof String) {
      return { message: err } as DataQueryError;
    }

    let message = 'Query error';
    if (error.message) {
      message = error.message;
    } else if (error.data && error.data.message) {
      message = error.data.message;
    } else if (error.data && error.data.error) {
      message = error.data.error;
    } else if (error.status) {
      message = `Query error: ${error.status} ${error.statusText}`;
    }
    error.message = message;
  }

  return error;
}

/**
 * Return the first string or non-time field as the value
 *
 * @beta
 */
export function frameToMetricFindValue(frame: DataFrame): MetricFindValue[] {
  if (!frame || !frame.length) {
    return [];
  }

  const values: MetricFindValue[] = [];
  let field = frame.fields.find((f) => f.type === FieldType.string);
  if (!field) {
    field = frame.fields.find((f) => f.type !== FieldType.time);
  }
  if (field) {
    for (let i = 0; i < field.values.length; i++) {
      values.push({ text: '' + field.values.get(i) });
    }
  }
  return values;
}
