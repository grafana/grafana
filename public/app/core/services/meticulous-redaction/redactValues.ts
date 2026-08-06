import { FieldType, type DataFrameJSON, type Labels } from '@grafana/data';

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function randomizeString(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    out += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return out;
}

export function randomizeNumber(value: number): number {
  // zero and non-finite values carry no customer information and are load-bearing for rendering
  if (value === 0 || !Number.isFinite(value)) {
    return value;
  }
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(value))));
  return Math.sign(value) * magnitude * (1 + Math.random() * 9);
}

/**
 * Fail-closed redactor for values of unknown shape: strings and numbers are
 * randomized, arrays and objects are walked recursively, everything else
 * (booleans, nulls) passes through.
 */
export function redactValueDeep(value: unknown): unknown {
  if (typeof value === 'string') {
    return randomizeString(value);
  }
  if (typeof value === 'number') {
    return randomizeNumber(value);
  }
  if (Array.isArray(value)) {
    return value.map(redactValueDeep);
  }
  if (value != null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redactValueDeep(entry)]));
  }
  return value;
}

interface FieldRedactionInput {
  values: unknown[];
  enums: string[] | null | undefined;
}

type FieldRedactor = (input: FieldRedactionInput) => FieldRedactionInput;

const passthrough: FieldRedactor = (input) => input;

const mapValues =
  (redactValue: (value: unknown) => unknown): FieldRedactor =>
  (input) => ({
    ...input,
    // preserve nulls and array length so `entities` index lookups stay valid
    values: input.values.map((value) => (value == null ? value : redactValue(value))),
  });

const redactEnumField: FieldRedactor = (input) => ({
  ...input,
  // values are integer codes into the enum dictionary; only the dictionary strings are sensitive
  enums: input.enums == null ? input.enums : input.enums.map(randomizeString),
});

/**
 * Per-field-type redaction registry. Types without an entry fall back to the
 * recursive fail-closed redactor, so unhandled or future field types can never
 * leak values. Extend by adding an entry (e.g. a nestedFrames redactor that
 * recurses into child frames).
 */
const FIELD_REDACTORS: Partial<Record<FieldType, FieldRedactor>> = {
  // time and boolean values are not customer data and keep charts rendering
  [FieldType.time]: passthrough,
  [FieldType.boolean]: passthrough,
  // fall back to deep redaction when a value doesn't match its declared field type
  [FieldType.number]: mapValues((value) =>
    typeof value === 'number' ? randomizeNumber(value) : redactValueDeep(value)
  ),
  [FieldType.string]: mapValues((value) =>
    typeof value === 'string' ? randomizeString(value) : redactValueDeep(value)
  ),
  [FieldType.enum]: redactEnumField,
};

const failClosedRedactor: FieldRedactor = mapValues(redactValueDeep);

function redactLabels(labels: Labels): Labels {
  return Object.fromEntries(Object.entries(labels).map(([key, value]) => [key, randomizeString(value)]));
}

/**
 * Returns a redacted copy of a DataFrameJSON. Never mutates the input.
 */
export function redactFrame(frame: DataFrameJSON): DataFrameJSON {
  const fields = frame.schema?.fields ?? [];

  const values = frame.data?.values ?? [];
  const enums = frame.data?.enums;
  const redactedValues: unknown[][] = [];
  const redactedEnums: Array<string[] | null> = [];

  for (let i = 0; i < values.length; i++) {
    const type = fields[i]?.type;
    const redactor = (type && FIELD_REDACTORS[type]) || failClosedRedactor;
    const result = redactor({ values: values[i], enums: enums?.[i] });
    redactedValues.push(result.values);
    redactedEnums.push(result.enums ?? null);
  }

  return {
    ...frame,
    ...(frame.schema && {
      schema: {
        ...frame.schema,
        ...(frame.schema.meta?.executedQueryString != null && {
          // query text can embed customer identifiers (label matchers, filters)
          meta: { ...frame.schema.meta, executedQueryString: randomizeString(frame.schema.meta.executedQueryString) },
        }),
        fields: fields.map((field) => (field.labels ? { ...field, labels: redactLabels(field.labels) } : field)),
      },
    }),
    ...(frame.data && {
      data: {
        ...frame.data,
        values: redactedValues,
        ...(enums && { enums: redactedEnums }),
      },
    }),
  };
}
