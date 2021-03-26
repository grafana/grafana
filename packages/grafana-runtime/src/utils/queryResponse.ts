import {
  DataQueryResponse,
  arrowTableToDataFrame,
  base64StringToArrowTable,
  LoadingState,
  DataQueryError,
  TimeSeries,
  TableData,
  toDataFrame,
  DataFrame,
  MetricFindValue,
  FieldType,
  DataQuery,
  DataFrameJSON,
  dataFrameFromJSON,
} from '@grafana/data';
import { isArray } from 'lodash';
import { FetchResponse } from '../services';

/**
 * Single response object from a backend data source. Properties are optional but response should contain at least
 * an error or a some data (but can contain both). Main way to send data is with dataframes attribute as series and
 * tables data attributes are legacy formats.
 *
 * @internal
 */
export interface DataResponse {
  refId?: string;
  error?: string;
  frames?: DataFrameJSON[];

  // Legacy TSDB format...
  dataframes?: string[]; // base64 encoded arrow tables
  series?: TimeSeries[];
  tables?: TableData[];
}

/**
 * This is the type of response expected form backend datasource.
 *
 * @internal
 */
export interface BackendDataSourceResponse {
  results: DataResponse[];
}

/**
 * Parse the results from /api/ds/query into a DataQueryResponse
 *
 * NOTE: this also supports responses from /api/tsdb, lets keep support for both until we
 * are sure it is not used/needed anywhere core.
 *
 * @param res - the HTTP response data.
 * @param queries - optional DataQuery array that will order the response based on the order of query refId's.
 *
 * @public
 */
export function toDataQueryResponse(
  res:
    | { data: BackendDataSourceResponse | undefined }
    | FetchResponse<BackendDataSourceResponse | undefined>
    | DataQueryError,
  queries?: DataQuery[]
): DataQueryResponse {
  const rsp: DataQueryResponse = { data: [], state: LoadingState.Done };

  const resultsObj = (res as FetchResponse).data?.results;

  // The new V8 path
  if (isArray(resultsObj)) {
    const results = resultsObj as DataResponse[];
    for (const res of results) {
      if (res.error) {
        rsp.state = LoadingState.Error;
        rsp.error = {
          refId: res.refId,
          message: res.error,
        };
      }

      if (res.frames) {
        for (const js of res.frames) {
          const df = dataFrameFromJSON(js);
          if (!df.refId) {
            df.refId = res.refId;
          }
          rsp.data.push(df);
        }
      }
    }
  } else if (resultsObj) {
    const results = (res as FetchResponse).data.results;
    const resultIDs = Object.keys(results);
    const refIDs = queries ? queries.map((q) => q.refId) : resultIDs;
    const usedResultIDs = new Set<string>(resultIDs);
    const data: DataResponse[] = [];

    for (const refId of refIDs) {
      const dr = results[refId];
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
        const dr = results[refId];
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
  if ((res as FetchResponse).status && (res as FetchResponse).status !== 200) {
    if (rsp.state !== LoadingState.Error) {
      rsp.state = LoadingState.Error;
    }
    if (!rsp.error) {
      rsp.error = toDataQueryError(res as DataQueryError);
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
export function toDataQueryError(err: DataQueryError | string | Object): DataQueryError {
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
