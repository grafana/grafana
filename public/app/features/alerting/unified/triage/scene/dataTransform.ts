import { DataFrame } from '@grafana/data';

import { AlertRuleRow, EmptyLabelValue, GenericGroupedRow, WorkbenchRow } from '../types';

// Single-pass implementation: 30x faster than previous approach
// Builds tree structure in one pass through data, avoiding intermediate row objects
export function convertToWorkbenchRows(series: DataFrame[], groupBy: string[] = []): WorkbenchRow[] {
  if (!series.at(0)?.fields.length) {
    return [];
  }

  const frame = series[0];

  // Build field index map
  const fieldIndex = new Map<string, number>();
  for (let i = 0; i < frame.fields.length; i++) {
    fieldIndex.set(frame.fields[i].name, i);
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
  if (!alertnameIndex || !folderIndex || !ruleUIDIndex) {
    return [];
  }

  const alertnameValues = frame.fields[alertnameIndex].values;
  const folderValues = frame.fields[folderIndex].values;
  const ruleUIDValues = frame.fields[ruleUIDIndex].values;

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
        });
      }
    }
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
          });
        }
      }

      return result;
    }

    const result: GenericGroupedRow[] = [];
    const emptyGroups: GenericGroupedRow[] = [];

    for (const [value, childNode] of node.children.entries()) {
      const group: GenericGroupedRow = {
        type: 'group',
        metadata: {
          label: groupBy[depth],
          value: value,
        },
        rows: nodeToRows(childNode, depth + 1),
      };

      if (value === EmptyLabelValue) {
        emptyGroups.push(group);
      } else {
        result.push(group);
      }
    }

    return [...result, ...emptyGroups];
  }

  return nodeToRows(root, 0);
}
