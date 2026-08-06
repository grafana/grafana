import { type TableData, type TimeSeries } from '@grafana/data';
import { type BackendDataSourceResponse, type DataResponse } from '@grafana/runtime';

import { randomizeNumber, randomizeString, redactFrame, redactValueDeep } from './redactValues';

const EXEMPT_DATASOURCE_TYPES = new Set(['grafana-testdata-datasource', 'testdata']);

interface QueryRequestBody {
  queries?: Array<{
    refId?: string;
    datasource?: {
      type?: string;
    };
  }>;
}

/**
 * refIds whose query targets a testdata datasource don't contain customer data
 * and are left intact. Expression queries (`__expr__`) are intentionally not
 * exempt: their output derives from real datasource data. An unparseable or
 * missing request body exempts nothing (fail closed).
 */
function getExemptRefIds(requestBodyText: string | undefined): Set<string> {
  const exempt = new Set<string>();
  if (!requestBodyText) {
    return exempt;
  }

  let body: QueryRequestBody;
  try {
    body = JSON.parse(requestBodyText);
  } catch {
    return exempt;
  }

  if (!Array.isArray(body?.queries)) {
    return exempt;
  }
  for (const query of body.queries) {
    if (query?.refId != null && EXEMPT_DATASOURCE_TYPES.has(query?.datasource?.type ?? '')) {
      exempt.add(query.refId);
    }
  }
  return exempt;
}

function redactLegacySeries(series: TimeSeries): TimeSeries {
  return {
    ...series,
    target: randomizeString(series.target ?? ''),
    // datapoints are [value, time] pairs; keep the timestamp so charts render
    datapoints: series.datapoints?.map(([value, ...rest]) => [value == null ? value : randomizeNumber(value), ...rest]),
  };
}

function redactLegacyTable(table: TableData): TableData {
  return {
    ...table,
    // there is no reliable way to identify time columns in the legacy format,
    // so every cell is redacted by runtime type (fail closed)
    rows: table.rows?.map((row) => row.map(redactValueDeep)),
  };
}

function redactDataResponse(response: DataResponse): DataResponse {
  return {
    ...response,
    ...(response.error != null && { error: randomizeString(response.error) }),
    ...(response.frames && { frames: response.frames.map(redactFrame) }),
    ...(response.series && { series: response.series.map(redactLegacySeries) }),
    ...(response.tables && { tables: response.tables.map(redactLegacyTable) }),
  };
}

function isBackendDataSourceResponse(data: unknown): data is BackendDataSourceResponse {
  return (
    data != null &&
    typeof data === 'object' &&
    'results' in data &&
    data.results != null &&
    typeof data.results === 'object'
  );
}

/**
 * Redacts a `/api/ds/query`-shaped response body before it is uploaded to
 * Meticulous. Returns the input object by reference when nothing needs
 * redacting — the Meticulous middleware treats an identical reference as a
 * no-op and keeps the original response bytes.
 *
 * Never mutates the input. Intentionally not wrapped in try/catch: an
 * exception thrown from recorder middleware makes Meticulous abandon the
 * recording, which is the fail-safe outcome (nothing uploads).
 */
export function redactQueryResponse(data: unknown, requestBodyText: string | undefined): unknown {
  if (!isBackendDataSourceResponse(data)) {
    // matching URL with an unrecognized envelope: redact everything we can find
    return redactValueDeep(data);
  }

  const exemptRefIds = getExemptRefIds(requestBodyText);

  const refIds = Object.keys(data.results);
  if (refIds.length > 0 && refIds.every((refId) => exemptRefIds.has(refId))) {
    return data;
  }

  return {
    ...data,
    results: Object.fromEntries(
      Object.entries(data.results).map(([refId, response]) => [
        refId,
        exemptRefIds.has(refId) ? response : redactDataResponse(response),
      ])
    ),
  };
}
