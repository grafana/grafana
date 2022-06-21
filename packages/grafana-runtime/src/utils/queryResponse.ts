import {
  DataQueryResponse,
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
  DataFrameJSON,
  dataFrameFromJSON,
  QueryResultMetaNotice,
} from '@grafana/data';

import { FetchError, FetchResponse } from '../services';

import { toDataQueryError } from './toDataQueryError';

export const cachedResponseNotice: QueryResultMetaNotice = { severity: 'info', text: 'Cached response' };

/**
 * Single response object from a backend data source. Properties are optional but response should contain at least
 * an error or a some data (but can contain both). Main way to send data is with dataframes attribute as series and
 * tables data attributes are legacy formats.
 *
 * @internal
 */
export interface DataResponse {
  error?: string;
  refId?: string;
  frames?: DataFrameJSON[];

  // Legacy TSDB format...
  series?: TimeSeries[];
  tables?: TableData[];
}

/**
 * This is the type of response expected form backend datasource.
 *
 * @internal
 */
export interface BackendDataSourceResponse {
  results: KeyValue<DataResponse>;
}

/**
 * Parse the results from /api/ds/query into a DataQueryResponse
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
  // If the response isn't in a correct shape we just ignore the data and pass empty DataQueryResponse.
  if ((res as FetchResponse).data?.results) {
    const results = (res as FetchResponse).data.results;
    const refIDs = queries?.length ? queries.map((q) => q.refId) : Object.keys(results);
    const cachedResponse = isCachedResponse(res as FetchResponse);
    const data: DataResponse[] = [];

    for (const refId of refIDs) {
      const dr = results[refId];
      if (!dr) {
        continue;
      }
      dr.refId = refId;
      data.push(dr);
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

      if (dr.frames?.length) {
        for (let js of dr.frames) {
          if (cachedResponse) {
            js = addCacheNotice(js);
          }
          const df = dataFrameFromJSON(js);
          if (!df.refId) {
            df.refId = dr.refId;
          }
          rsp.data.push(df);
        }
        continue; // the other tests are legacy
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

function isCachedResponse(res: FetchResponse<BackendDataSourceResponse | undefined>): boolean {
  const headers = res?.headers;
  if (!headers || !headers.get) {
    return false;
  }
  return headers.get('X-Cache') === 'HIT';
}

function addCacheNotice(frame: DataFrameJSON): DataFrameJSON {
  return {
    ...frame,
    schema: {
      ...frame.schema,
      fields: [...(frame.schema?.fields ?? [])],
      meta: {
        ...frame.schema?.meta,
        notices: [...(frame.schema?.meta?.notices ?? []), cachedResponseNotice],
        isCachedResponse: true,
      },
    },
  };
}

/**
 * Data sources using api/ds/query to test data sources can use this function to
 * handle errors and convert them to TestingStatus object.
 *
 * If possible, this should be avoided in favor of implementing /health endpoint
 * and testing data source with DataSourceWithBackend.testDataSource()
 *
 * Re-thrown errors are handled by testDataSource() in public/app/features/datasources/state/actions.ts
 *
 * @returns {TestingStatus}
 */
export function toTestingStatus(err: FetchError): any {
  const queryResponse = toDataQueryResponse(err);
  // POST api/ds/query errors returned as { message: string, error: string } objects
  if (queryResponse.error?.data?.message) {
    return {
      status: 'error',
      message: queryResponse.error.data.message,
      details: queryResponse.error?.data?.error ? { message: queryResponse.error.data.error } : undefined,
    };
  }
  // POST api/ds/query errors returned in results object
  else if (queryResponse.error?.refId && queryResponse.error?.message) {
    return {
      status: 'error',
      message: queryResponse.error.message,
    };
  }

  throw err;
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
