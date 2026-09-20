import { dataFrameFromJSON, FieldType, type DataFrame, type DataFrameJSON } from '@grafana/data';

// Imported by path rather than through '@grafana/runtime': vite aliases that
// specifier to the shim at build time, and queryResponse.ts is not reachable through
// the package's own exports.
import { toDataQueryResponse, type BackendDataSourceResponse } from '../shims/grafana-runtime';

/**
 * Decoders for Grafana's real query wire format.
 *
 * This is what replaces per-datasource parsing. `/api/ds/query` answers every
 * datasource Grafana supports in one shape (DataFrameJSON), so a host that can reach
 * that endpoint, directly or by proxy through an agent host, can feed any panel type
 * with any datasource behind it.
 */

/** A single query's frames, as they appear inside a /api/ds/query response. */
export function framesFromDataFrameJSON(frames: DataFrameJSON[]): DataFrame[] {
  // dataFrameFromJSON mutates dto.data.values in place, so callers must not reuse
  // the same parsed JSON for a second decode.
  return frames.map(dataFrameFromJSON);
}

/**
 * A whole /api/ds/query response: `{ results: { <refId>: { frames } } }`.
 * Uses Grafana's own decoder, so error and status handling matches the app.
 */
export function framesFromQueryResponse(body: BackendDataSourceResponse): DataFrame[] {
  const decoded = toDataQueryResponse({ data: body });
  return decoded.data ?? [];
}

interface PromSample {
  metric: Record<string, string>;
  values?: Array<[number, string]>;
}

/**
 * Prometheus range-query matrix, for hosts that only have a raw Prometheus response
 * to hand. Kept deliberately separate from the decoders above: it is a convenience
 * for one datasource, not the data plane.
 */
export function framesFromPromMatrix(
  matrix: PromSample[],
  opts?: { unit?: string; fallbackName?: string }
): DataFrame[] {
  const { unit, fallbackName } = opts ?? {};
  return matrix
    .filter((sample): sample is PromSample & { values: Array<[number, string]> } => Boolean(sample.values))
    .map((sample) => {
      const labels = Object.entries(sample.metric).filter(([key]) => key !== '__name__');
      const name =
        Object.keys(sample.metric).length === 0
          ? (fallbackName ?? 'value')
          : `${sample.metric.__name__ ?? ''}{${labels.map(([k, v]) => `${k}="${v}"`).join(', ')}}`;
      return {
        // Deliberately no frame `name`: getFieldDisplayName joins the frame name and
        // the field name when both are set, which duplicates the series label.
        refId: 'A',
        length: sample.values.length,
        fields: [
          {
            name: 'Time',
            type: FieldType.time,
            config: {},
            values: sample.values.map(([ts]) => ts * 1000),
          },
          {
            name,
            type: FieldType.number,
            config: unit ? { unit } : {},
            values: sample.values.map(([, value]) => parseFloat(value)),
          },
        ],
      };
    });
}
