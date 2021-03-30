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
  DataFrameJSON,
  dataFrameFromJSON,
  dataFrameToJSON,
} from '@grafana/data';
import { FetchResponse } from '../services';

/**
 * Single response object from a backend data source. Properties are optional but response should contain at least
 * an error or a some data (but can contain both).
 *
 * @internal
 */
export interface DataResponse {
  refId?: string;
  error?: string;
  frames?: DataFrameJSON[];
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
 * @param res - the HTTP response data.
 *
 * @public
 */
export function toDataQueryResponse(
  res:
    | { data: BackendDataSourceResponse | undefined }
    | FetchResponse<BackendDataSourceResponse | undefined>
    | DataQueryError
): DataQueryResponse {
  const rsp: DataQueryResponse = { data: [], state: LoadingState.Done };

  const response = (res as FetchResponse).data as BackendDataSourceResponse;

  if (response?.results) {
    for (const res of response.results) {
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

export interface LegacyDataResponse {
  refId?: string;
  error?: string;

  // Legacy TSDB format...
  dataframes?: string[]; // base64 encoded arrow tables
  series?: TimeSeries[];
  tables?: TableData[];
}

/**
 * ONLY needed for tests right now!
 */
export function legacyDataResponseToDataResponse(legacy: Record<string, LegacyDataResponse | any>): DataResponse[] {
  const res: DataResponse[] = [];

  for (const [key, dr] of Object.entries(legacy)) {
    const converted: DataResponse = {
      refId: key,
      error: dr.error,
      frames: [],
    };
    res.push(converted);

    if (dr.series?.length) {
      for (const s of dr.series) {
        const df = toDataFrame(s);
        converted.frames!.push(dataFrameToJSON(df));
      }
    }

    if (dr.tables?.length) {
      for (const s of dr.tables) {
        const df = toDataFrame(s);
        converted.frames!.push(dataFrameToJSON(df));
      }
    }

    if (dr.dataframes) {
      for (const b64 of dr.dataframes) {
        const t = base64StringToArrowTable(b64);
        const f = arrowTableToDataFrame(t);
        if (!f.refId) {
          f.refId = dr.refId;
        }
        converted.frames!.push(dataFrameToJSON(f));
      }
    }
  }

  return res;
}
