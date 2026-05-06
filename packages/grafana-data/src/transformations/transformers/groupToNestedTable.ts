import { map } from 'rxjs/operators';

import type { MatcherConfig } from '@grafana/schema';

import { guessFieldTypeForField } from '../../dataframe/processDataFrame';
import { getFieldDisplayName } from '../../field/fieldState';
import { type DataFrame, type Field, FieldType } from '../../types/dataFrame';
import { type DataTransformerInfo, TransformationApplicabilityLevels } from '../../types/transformations';
import { ReducerID, reduceField } from '../fieldReducer';
import { getFieldMatcher } from '../matchers';
import { FieldMatcherID } from '../matchers/ids';

import { type GroupByFieldOptions, GroupByOperationID, createGroupedFields, groupValuesByKey } from './groupBy';
import { DataTransformerID } from './ids';
import { findMaxFields } from './utils';

export const SHOW_NESTED_HEADERS_DEFAULT = true;
export const EXPAND_ALL_ROWS_DEFAULT = false;
const MINIMUM_FIELDS_REQUIRED = 2;

// ---------------------------------------------------------------------------
// V1 options (field-name keyed record) — kept for backward compatibility
// ---------------------------------------------------------------------------

/**
 * @deprecated Use GroupToNestedTableTransformerOptionsV2 instead.
 * Existing configs using this shape are automatically migrated at runtime.
 */
export interface GroupToNestedTableTransformerOptions {
  showSubframeHeaders?: boolean;
  expandAllRows?: boolean;
  fields: Record<string, GroupByFieldOptions>;
}

// ---------------------------------------------------------------------------
// V2 options (matcher-based rules)
// ---------------------------------------------------------------------------

export interface GroupToNestedTableMatcherConfig {
  /** The field matcher that selects which fields this rule applies to. */
  matcher: MatcherConfig;
  /** Whether matched fields are grouped on or have aggregations calculated. */
  operation: GroupByOperationID | null;
  /** Aggregation reducers to apply when operation is 'aggregate'. */
  aggregations: ReducerID[];
  /**
   * When operation is 'aggregate', setting this to true also retains the raw field
   * values in the nested sub-frame alongside the aggregated outer column.
   * Defaults to false (undefined treated as false) — aggregated fields are excluded
   * from the nested frame by default.
   */
  keepNestedField?: boolean;
}

export interface GroupToNestedTableTransformerOptionsV2 {
  showSubframeHeaders?: boolean;
  /** When true, all nested rows are expanded by default when the panel loads. */
  expandAllRows?: boolean;
  /** Ordered list of matcher rules. First matching rule for a field wins. */
  rules: GroupToNestedTableMatcherConfig[];
}

// ---------------------------------------------------------------------------
// Type guard & migration
// ---------------------------------------------------------------------------

/**
 * Returns true if the options object is in the legacy V1 shape (field-name keyed record).
 */
export function isV1GroupToNestedTableOptions(
  opts: GroupToNestedTableTransformerOptions | GroupToNestedTableTransformerOptionsV2
): opts is GroupToNestedTableTransformerOptions {
  // A config is V1 only if it has `fields` but NOT `rules`.
  // After a shallow merge of defaultOptions (which has `fields: {}`) with a V2 config
  // (which has `rules`), both keys will be present — we treat that as V2.
  return 'fields' in opts && !('rules' in opts);
}

/**
 * Converts V1 (field-name keyed) options to the V2 (matcher-based rules) shape.
 * Each field name in the V1 record becomes a byName matcher rule in the V2 array,
 * preserving the same operation and aggregation settings.
 */
export function migrateGroupToNestedTableOptions(
  options: GroupToNestedTableTransformerOptions
): GroupToNestedTableTransformerOptionsV2 {
  const rules: GroupToNestedTableMatcherConfig[] = Object.entries(options.fields).map(([fieldName, fieldOpts]) => ({
    matcher: { id: FieldMatcherID.byName, options: fieldName },
    operation: fieldOpts.operation,
    aggregations: fieldOpts.aggregations ?? [],
    keepNestedField: false,
  }));

  return {
    showSubframeHeaders: options.showSubframeHeaders,
    expandAllRows: options.expandAllRows,
    rules,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers for V2 operator
// ---------------------------------------------------------------------------

interface FieldMap {
  [key: string]: Field;
}

/**
 * Given V2 rules and the available frame+allFrames context, finds the first
 * matching rule for a field. Returns undefined if no rule matches.
 */
function findMatchingRule(
  field: Field,
  frame: DataFrame,
  allFrames: DataFrame[],
  rules: GroupToNestedTableMatcherConfig[]
): GroupToNestedTableMatcherConfig | undefined {
  for (const rule of rules) {
    const matcher = getFieldMatcher(rule.matcher);
    if (matcher(field, frame, allFrames)) {
      return rule;
    }
  }
  return undefined;
}

/**
 * Returns true if a field should be grouped on according to V2 rules.
 */
function shouldGroupOnField(
  field: Field,
  frame: DataFrame,
  allFrames: DataFrame[],
  rules: GroupToNestedTableMatcherConfig[]
): boolean {
  const rule = findMatchingRule(field, frame, allFrames, rules);
  return rule?.operation === GroupByOperationID.groupBy;
}

/**
 * Returns true if aggregations should be calculated for a field according to V2 rules.
 */
function shouldCalculateField(
  field: Field,
  frame: DataFrame,
  allFrames: DataFrame[],
  rules: GroupToNestedTableMatcherConfig[]
): boolean {
  const rule = findMatchingRule(field, frame, allFrames, rules);
  return (
    rule?.operation === GroupByOperationID.aggregate && Array.isArray(rule.aggregations) && rule.aggregations.length > 0
  );
}

// ---------------------------------------------------------------------------
// Transformer
// ---------------------------------------------------------------------------

export const groupToNestedTable: DataTransformerInfo<
  GroupToNestedTableTransformerOptions | GroupToNestedTableTransformerOptionsV2
> = {
  id: DataTransformerID.groupToNestedTable,
  name: 'Group to nested tables',
  description: 'Group data by a field value and create nested tables with the grouped data',
  defaultOptions: {
    showSubframeHeaders: SHOW_NESTED_HEADERS_DEFAULT,
    // Default to V1 shape so existing panels without any saved options are handled gracefully.
    // The operator migrates V1 → V2 in-memory on every run.
    fields: {},
  },
  isApplicable: (data) => {
    const maxFields = findMaxFields(data);
    return maxFields >= MINIMUM_FIELDS_REQUIRED
      ? TransformationApplicabilityLevels.Applicable
      : TransformationApplicabilityLevels.NotApplicable;
  },
  isApplicableDescription: (data: DataFrame[]) => {
    const maxFields = findMaxFields(data);
    return `The Group to nested table transformation requires a series with at least ${MINIMUM_FIELDS_REQUIRED} fields to work. The maximum number of fields found on a series is ${maxFields}`;
  },
  operator: (rawOptions) => (source) =>
    source.pipe(
      map((data) => {
        // Normalise to V2 — migrate in-memory if V1 config is detected
        const options: GroupToNestedTableTransformerOptionsV2 = isV1GroupToNestedTableOptions(rawOptions)
          ? migrateGroupToNestedTableOptions(rawOptions)
          : rawOptions;

        const hasGroupByRule = options.rules.some((r) => r.operation === GroupByOperationID.groupBy);
        if (!hasGroupByRule) {
          return data;
        }

        const processed: DataFrame[] = [];

        for (const frame of data) {
          // Identify fields to group on
          const groupByFields: Field[] = frame.fields.filter((field) =>
            shouldGroupOnField(field, frame, data, options.rules)
          );
          if (groupByFields.length === 0) {
            continue;
          }

          // Group values by the composite group key
          const valuesByGroupKey = groupValuesByKey(frame, groupByFields);

          // Build the outer (grouped) fields
          const fields: Field[] = createGroupedFields(groupByFields, valuesByGroupKey);

          // Build sub-frames for rows that are neither grouped nor aggregated
          const subFrames: DataFrame[][] = groupToSubframes(valuesByGroupKey, frame, data, options);

          // For each field that should be calculated, compute aggregations
          for (const field of frame.fields) {
            if (!shouldCalculateField(field, frame, data, options.rules)) {
              continue;
            }

            const rule = findMatchingRule(field, frame, data, options.rules)!;
            const fieldName = getFieldDisplayName(field);
            const { aggregations } = rule;
            const valuesByAggregation: Record<string, unknown[]> = {};

            valuesByGroupKey.forEach((value) => {
              const fieldWithValuesForGroup = value[fieldName];
              const results = reduceField({
                field: fieldWithValuesForGroup,
                reducers: aggregations,
              });

              for (const aggregation of aggregations) {
                if (!Array.isArray(valuesByAggregation[aggregation])) {
                  valuesByAggregation[aggregation] = [];
                }
                valuesByAggregation[aggregation].push(results[aggregation]);
              }
            });

            for (const aggregation of aggregations) {
              const aggregationField: Field = {
                name: `${fieldName} (${aggregation})`,
                values: valuesByAggregation[aggregation],
                type: FieldType.other,
                config: {},
              };
              aggregationField.type = detectFieldType(aggregation, field, aggregationField);
              fields.push(aggregationField);
            }
          }

          fields.push({
            config: {},
            name: '__nestedFrames',
            type: FieldType.nestedFrames,
            values: subFrames,
          });

          const expandAllRows = options.expandAllRows ?? EXPAND_ALL_ROWS_DEFAULT;
          processed.push({
            meta: expandAllRows ? { custom: { expandAllRows: true } } : undefined,
            fields,
            length: valuesByGroupKey.size,
          });
        }

        return processed;
      })
    ),
};

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Given the appropriate data, create a sub-frame
 * which can then be displayed in a sub-table.
 */
function createSubframe(
  fields: Field[],
  frameLength: number,
  { showSubframeHeaders = SHOW_NESTED_HEADERS_DEFAULT }: GroupToNestedTableTransformerOptionsV2,
  stableRowKey: string
) {
  return {
    meta: { custom: { noHeader: !showSubframeHeaders, stableRowKey } },
    length: frameLength,
    fields,
  };
}

/**
 * Detect the type of field given the relevant aggregation.
 */
const detectFieldType = (aggregation: string, sourceField: Field, targetField: Field): FieldType => {
  switch (aggregation) {
    case ReducerID.allIsNull:
      return FieldType.boolean;
    case ReducerID.last:
    case ReducerID.lastNotNull:
    case ReducerID.first:
    case ReducerID.firstNotNull:
      return sourceField.type;
    default:
      return guessFieldTypeForField(targetField) ?? FieldType.string;
  }
};

/**
 * Group values into sub-frames for fields that are not grouped or aggregated (V2 version).
 * Fields without a matching rule, or with a rule that has no operation, fall into the nested table.
 */
function groupToSubframes(
  valuesByGroupKey: Map<string, FieldMap>,
  frame: DataFrame,
  allFrames: DataFrame[],
  options: GroupToNestedTableTransformerOptionsV2
): DataFrame[][] {
  const subFrames: DataFrame[][] = [];

  for (const [groupKey, value] of valuesByGroupKey) {
    const nestedFields: Field[] = [];

    for (const fieldName in value) {
      const field = value[fieldName];
      // Find the source field in the original frame to test against matchers
      const sourceField = frame.fields.find((f) => getFieldDisplayName(f) === fieldName) ?? field;
      const rule = findMatchingRule(sourceField, frame, allFrames, options.rules);

      if (rule === undefined) {
        // No rule matched — include in nested table
        nestedFields.push(field);
      } else if (
        rule.aggregations == null ||
        rule.operation == null ||
        (rule.operation === GroupByOperationID.aggregate && rule.aggregations.length === 0)
      ) {
        // Rule exists but is unconfigured — include in nested table
        nestedFields.push(field);
      } else if (rule.operation === GroupByOperationID.aggregate && rule.keepNestedField === true) {
        // Aggregated field with keepNestedField — include raw values in nested table too
        nestedFields.push(field);
      }
      // operation === groupBy, or aggregate with reducers and keepNestedField not set → excluded from nested table
    }

    if (nestedFields.length > 0) {
      subFrames.push([createSubframe(nestedFields, nestedFields[0].values.length, options, groupKey)]);
    } else {
      subFrames.push([createSubframe([], 0, options, groupKey)]);
    }
  }

  return subFrames;
}
