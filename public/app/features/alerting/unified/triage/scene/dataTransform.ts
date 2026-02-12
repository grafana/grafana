import { DataFrame } from '@grafana/data';

import { AlertRuleRow, EmptyLabelValue, GenericGroupedRow, InstanceCounts, WorkbenchRow } from '../types';

const EMPTY_COUNTS: InstanceCounts = { firing: 0, pending: 0 };
const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

function sumCounts(rows: WorkbenchRow[]): InstanceCounts {
  let firing = 0;
  let pending = 0;
  for (const row of rows) {
    firing += row.instanceCounts.firing;
    pending += row.instanceCounts.pending;
  }
  return { firing, pending };
}

/**
 * Pre-computes a map of ruleUID → InstanceCounts by summing Values per (ruleUID, alertstate).
 *
 * Expects single-timestamp instant query data where deduplication has already been done
 * at the PromQL level. When groupBy labels are active the query produces multiple rows
 * per (ruleUID, alertstate) — one per group value — which are summed together.
 */
function buildRuleCountsMap(
  frame: DataFrame,
  fieldIndex: Map<string, number>,
  ruleUIDValues: DataFrame['fields'][number]['values']
): Map<string, InstanceCounts> {
  const alertstateIdx = fieldIndex.get('alertstate');
  const valueIdx = fieldIndex.get('Value');

  if (alertstateIdx === undefined || valueIdx === undefined) {
    return new Map();
  }

  const alertstateValues = frame.fields[alertstateIdx].values;
  const valueValues = frame.fields[valueIdx].values;

  const result = new Map<string, InstanceCounts>();

  for (let i = 0; i < frame.length; i++) {
    const ruleUID = ruleUIDValues[i];
    const alertstate = alertstateValues[i];
    const value = valueValues[i] ?? 0;

    if (!ruleUID || (alertstate !== 'firing' && alertstate !== 'pending')) {
      continue;
    }

    let counts = result.get(ruleUID);
    if (!counts) {
      counts = { firing: 0, pending: 0 };
      result.set(ruleUID, counts);
    }

    if (alertstate === 'firing') {
      counts.firing += value;
    } else {
      counts.pending += value;
    }
  }

  return result;
}

// Builds tree structure in one pass through data, avoiding intermediate row objects
export function convertToWorkbenchRows(series: DataFrame[], groupBy: string[] = []): WorkbenchRow[] {
  if (!series.at(0)?.fields.length) {
    return [];
  }

  const frame = series[0];

  // Build field index map
  // When multiple queries share a Scenes query runner, the Prometheus plugin
  // renames "Value" to "Value #<refId>" (e.g. "Value #B"). Normalize it back.
  const fieldIndex = new Map<string, number>();
  for (let i = 0; i < frame.fields.length; i++) {
    const name = frame.fields[i].name;
    fieldIndex.set(name, i);
    if (name.startsWith('Value #')) {
      fieldIndex.set('Value', i);
    }
  }

  // Validate required fields exist
  if (
    !fieldIndex.has('Time') ||
    !fieldIndex.has('alertname') ||
    !fieldIndex.has('grafana_folder') ||
    !fieldIndex.has('grafana_rule_uid') ||
    !fieldIndex.has('alertstate')
  ) {
    return [];
  }

  // Get required field value arrays (direct columnar access)
  const alertnameIndex = fieldIndex.get('alertname');
  const folderIndex = fieldIndex.get('grafana_folder');
  const ruleUIDIndex = fieldIndex.get('grafana_rule_uid');

  // These should always exist due to validation above, but handle gracefully
  if (alertnameIndex === undefined || folderIndex === undefined || ruleUIDIndex === undefined) {
    return [];
  }

  const alertnameValues = frame.fields[alertnameIndex].values;
  const folderValues = frame.fields[folderIndex].values;
  const ruleUIDValues = frame.fields[ruleUIDIndex].values;

  // Pre-compute instance counts per rule
  const ruleCountsMap = buildRuleCountsMap(frame, fieldIndex, ruleUIDValues);

  function getRuleCounts(ruleUID: string): InstanceCounts {
    return ruleCountsMap.get(ruleUID) ?? EMPTY_COUNTS;
  }

  // Get groupBy field value arrays
  const groupByValueArrays = groupBy.map((key) => {
    const index = fieldIndex.get(key);
    return index !== undefined ? frame.fields[index]?.values : undefined;
  });

  // Fast path: no grouping - just dedupe alert rules
  if (groupBy.length === 0) {
    const seen = new Set<string>();
    const result: AlertRuleRow[] = [];

    for (let i = 0; i < frame.length; i++) {
      const ruleUID = ruleUIDValues[i];
      if (ruleUID && !seen.has(ruleUID)) {
        seen.add(ruleUID);
        result.push({
          type: 'alertRule',
          metadata: {
            title: alertnameValues[i],
            folder: folderValues[i],
            ruleUID: ruleUID,
          },
          instanceCounts: getRuleCounts(ruleUID),
        });
      }
    }
    result.sort((a, b) => collator.compare(a.metadata.title, b.metadata.title));
    return result;
  }

  // Build nested group structure in single pass
  interface GroupNode {
    children: Map<string | typeof EmptyLabelValue, GroupNode>;
    rowIndices: number[];
  }

  const root: GroupNode = {
    children: new Map(),
    rowIndices: [],
  };

  // Single pass: build entire tree
  for (let rowIdx = 0; rowIdx < frame.length; rowIdx++) {
    let node = root;

    // Navigate/create path through tree
    for (let depth = 0; depth < groupBy.length; depth++) {
      const rawValue = groupByValueArrays[depth]?.[rowIdx];
      const value = rawValue === '' || rawValue === undefined ? EmptyLabelValue : rawValue;

      let childNode = node.children.get(value);
      if (!childNode) {
        childNode = {
          children: new Map(),
          rowIndices: [],
        };
        node.children.set(value, childNode);
      }

      node = childNode;
    }

    // At leaf level, track row index
    node.rowIndices.push(rowIdx);
  }

  // Convert tree to WorkbenchRow format
  function nodeToRows(node: GroupNode, depth: number): WorkbenchRow[] {
    if (depth >= groupBy.length) {
      // Leaf level - create alert rule rows
      const seen = new Set<string>();
      const result: AlertRuleRow[] = [];

      for (const rowIdx of node.rowIndices) {
        const ruleUID = ruleUIDValues[rowIdx];
        if (ruleUID && !seen.has(ruleUID)) {
          seen.add(ruleUID);
          result.push({
            type: 'alertRule',
            metadata: {
              title: alertnameValues[rowIdx],
              folder: folderValues[rowIdx],
              ruleUID: ruleUID,
            },
            instanceCounts: getRuleCounts(ruleUID),
          });
        }
      }

      result.sort((a, b) => collator.compare(a.metadata.title, b.metadata.title));
      return result;
    }

    const result: GenericGroupedRow[] = [];
    const emptyGroups: GenericGroupedRow[] = [];

    for (const [value, childNode] of node.children.entries()) {
      const childRows = nodeToRows(childNode, depth + 1);
      const group: GenericGroupedRow = {
        type: 'group',
        metadata: {
          label: groupBy[depth],
          value: value,
        },
        rows: childRows,
        instanceCounts: sumCounts(childRows),
      };

      if (value === EmptyLabelValue) {
        emptyGroups.push(group);
      } else {
        result.push(group);
      }
    }

    result.sort((a, b) => collator.compare(String(a.metadata.value), String(b.metadata.value)));
    return [...result, ...emptyGroups];
  }

  return nodeToRows(root, 0);
}
