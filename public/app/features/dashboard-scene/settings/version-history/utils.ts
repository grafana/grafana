import { compare, type Operation } from 'fast-json-patch';
// @ts-ignore
import jsonMap from 'json-source-map';
import { flow, get, isArray, isEmpty, last, sortBy, tail, toNumber, isNaN } from 'lodash';

export type Diff = {
  op: 'add' | 'replace' | 'remove' | 'copy' | 'test' | '_get' | 'move';
  value: unknown;
  originalValue: unknown;
  path: string[];
  startLineNumber: number;
  endLineNumber: number;
};

export type Diffs = {
  [key: string]: Diff[];
};

type JSONValue = string | Object;

export const jsonDiff = (lhs: JSONValue, rhs: JSONValue): Diffs => {
  const diffs = compare(lhs, rhs);
  const lhsMap = jsonMap.stringify(lhs, null, 2);
  const rhsMap = jsonMap.stringify(rhs, null, 2);

  const getDiffInformation = (diffs: Operation[]): Diff[] => {
    return diffs.map((diff) => {
      let originalValue = undefined;
      let value = undefined;
      let startLineNumber = 0;
      let endLineNumber = 0;

      const path = tail(diff.path.split('/'));

      if (diff.op === 'replace' && rhsMap.pointers[diff.path]) {
        originalValue = get(lhs, path);
        value = diff.value;
        startLineNumber = rhsMap.pointers[diff.path].value.line;
        endLineNumber = rhsMap.pointers[diff.path].valueEnd.line;
      }
      if (diff.op === 'add' && rhsMap.pointers[diff.path]) {
        value = diff.value;
        startLineNumber = rhsMap.pointers[diff.path].value.line;
        endLineNumber = rhsMap.pointers[diff.path].valueEnd.line;
      }
      if (diff.op === 'remove' && lhsMap.pointers[diff.path]) {
        originalValue = get(lhs, path);
        startLineNumber = lhsMap.pointers[diff.path].value.line;
        endLineNumber = lhsMap.pointers[diff.path].valueEnd.line;
      }

      return {
        op: diff.op,
        value,
        path,
        originalValue,
        startLineNumber,
        endLineNumber,
      };
    });
  };

  const sortByLineNumber = (diffs: Diff[]) => sortBy(diffs, 'startLineNumber');
  const groupByPath = (diffs: Diff[]) =>
    diffs.reduce<Record<string, Diff[]>>((acc, value) => {
      const groupKey: string = value.path[0];
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(value);
      return acc;
    }, {});

  return flow([getDiffInformation, sortByLineNumber, groupByPath])(diffs);
};

// The panel runtime writes the running plugin version the first time a panel renders.
// That stamp is not an edit. Saved revisions still show it, because those go through jsonDiff directly.
export function omitRenderedPluginVersionDiffs(diffs: Diffs): Diffs {
  const kept: Diffs = {};

  for (const [group, changes] of Object.entries(diffs)) {
    const remaining = changes.filter((change) => !isRenderedPluginVersionPath(change.path));
    if (remaining.length > 0) {
      kept[group] = remaining;
    }
  }

  return kept;
}

function isRenderedPluginVersionPath(path: string[]): boolean {
  const field = path[path.length - 1];
  if (field === 'pluginVersion') {
    return true;
  }

  // v2 stores the same value at elements.*.spec.vizConfig.version
  return field === 'version' && path[path.length - 2] === 'vizConfig';
}

export const getDiffText = (diff: Diff, showProp = true) => {
  const prop = last(diff.path)!;
  const propIsNumeric = isNumeric(prop);
  const val = diff.op === 'remove' ? diff.originalValue : diff.value;
  let text = getDiffOperationText(diff.op);

  if (showProp) {
    if (propIsNumeric) {
      text += ` item ${prop}`;
    } else {
      if (isArray(val) && !isEmpty(val)) {
        text += ` ${val.length} ${prop}`;
      } else {
        text += ` ${prop}`;
      }
    }
  }

  return text;
};

const isNumeric = (value: string) => !isNaN(toNumber(value));

export const getDiffOperationText = (operation: string): string => {
  if (operation === 'add') {
    return 'added';
  }
  if (operation === 'remove') {
    return 'deleted';
  }
  return 'changed';
};
