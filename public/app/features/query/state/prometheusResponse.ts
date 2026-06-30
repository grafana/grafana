import { createDataFrame, type DataFrame, FieldType } from '@grafana/data';

type PrometheusSample = [number | string, number | string];

interface PrometheusData {
  resultType?: string;
  result?: unknown;
}

export function isDataFrameResponse(result: unknown): result is { data: DataFrame[] } {
  return isRecord(result) && Array.isArray(result.data);
}

export function prometheusResponseToDataFrames(result: unknown, refId: string): DataFrame[] | undefined {
  const prometheusData = getPrometheusData(result);
  if (!prometheusData) {
    return undefined;
  }

  return prometheusDataToFrames(prometheusData, refId);
}

function getPrometheusData(result: unknown): PrometheusData | undefined {
  const body = asPrometheusData(result);
  if (body) {
    return body;
  }

  if (!isRecord(result)) {
    return undefined;
  }

  const data = asPrometheusData(result.data);
  if (data) {
    return data;
  }

  if (isRecord(result.data)) {
    return asPrometheusData(result.data.data);
  }

  return undefined;
}

function prometheusDataToFrames(data: PrometheusData, refId: string): DataFrame[] {
  switch (data.resultType) {
    case 'scalar': {
      const point = parsePrometheusSample(data.result);
      return point ? [createPrometheusFrame(refId, [point])] : [];
    }
    case 'vector':
      return Array.isArray(data.result)
        ? data.result.flatMap((item) => {
            const result = isRecord(item) ? item : undefined;
            const point = parsePrometheusSample(result?.value);
            return point ? [createPrometheusFrame(refId, [point], toLabels(result?.metric))] : [];
          })
        : [];
    case 'matrix':
      return Array.isArray(data.result)
        ? data.result.flatMap((item) => {
            const result = isRecord(item) ? item : undefined;
            const values = Array.isArray(result?.values) ? result.values : [];
            const points = values.flatMap((value) => {
              const point = parsePrometheusSample(value);
              return point ? [point] : [];
            });

            return points.length ? [createPrometheusFrame(refId, points, toLabels(result?.metric))] : [];
          })
        : [];
    default:
      return [];
  }
}

function createPrometheusFrame(
  refId: string,
  points: Array<{ time: number; value: number }>,
  labels?: Record<string, string>
): DataFrame {
  return createDataFrame({
    refId,
    name: labels?.__name__ ?? refId,
    fields: [
      { name: 'Time', type: FieldType.time, values: points.map((point) => point.time) },
      { name: 'Value', type: FieldType.number, labels, values: points.map((point) => point.value) },
    ],
  });
}

function parsePrometheusSample(value: unknown): { time: number; value: number } | null {
  if (!isPrometheusSample(value)) {
    return null;
  }

  const time = Number(value[0]);
  const sample = parsePrometheusNumber(value[1]);
  if (!Number.isFinite(time) || sample == null) {
    return null;
  }

  return { time: time * 1000, value: sample };
}

function parsePrometheusNumber(value: number | string): number | null {
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }

  const normalized = value === 'Inf' || value === '+Inf' ? 'Infinity' : value === '-Inf' ? '-Infinity' : value;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

function isPrometheusSample(value: unknown): value is PrometheusSample {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    (typeof value[0] === 'number' || typeof value[0] === 'string') &&
    (typeof value[1] === 'number' || typeof value[1] === 'string')
  );
}

function asPrometheusData(value: unknown): PrometheusData | undefined {
  return isRecord(value) && typeof value.resultType === 'string' && 'result' in value ? value : undefined;
}

function toLabels(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const labels = Object.entries(value).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === 'string') {
      acc[key] = value;
    }
    return acc;
  }, {});

  return Object.keys(labels).length ? labels : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
