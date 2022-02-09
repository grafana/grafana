import { compare, Operation } from 'fast-json-patch';
// @ts-ignore
import jsonMap from 'json-source-map';
import { flow, get, isArray, isEmpty, last, sortBy, tail, toNumber, isNaN } from 'lodash';

export type Diff = {
  op: 'add' | 'replace' | 'remove' | 'copy' | 'test' | '_get' | 'move';
  value: any;
  originalValue: any;
  path: string[];
  startLineNumber: number;
};

export type Diffs = {
  [key: string]: Diff[];
};

export const jsonDiff = (lhs: any, rhs: any): Diffs => {
  const diffs = compare(lhs, rhs);
  const lhsMap = jsonMap.stringify(lhs, null, 2);
  const rhsMap = jsonMap.stringify(rhs, null, 2);

  const getDiffInformation = (diffs: Operation[]): Diff[] => {
    return diffs.map((diff) => {
      let originalValue = undefined;
      let value = undefined;
      let startLineNumber = 0;

      const path = tail(diff.path.split('/'));

      if (diff.op === 'replace') {
        originalValue = get(lhs, path);
        value = diff.value;
        startLineNumber = rhsMap.pointers[diff.path].value.line;
      }
      if (diff.op === 'add') {
        value = diff.value;
        startLineNumber = rhsMap.pointers[diff.path].value.line;
      }
      if (diff.op === 'remove') {
        originalValue = get(lhs, path);
        startLineNumber = lhsMap.pointers[diff.path].value.line;
      }

      return {
        op: diff.op,
        value,
        path,
        originalValue,
        startLineNumber,
      };
    });
  };

  const sortByLineNumber = (diffs: Diff[]) => sortBy(diffs, 'startLineNumber');
  const groupByPath = (diffs: Diff[]) =>
    diffs.reduce<Record<string, any>>((acc, value) => {
      const groupKey: string = value.path[0];
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(value);
      return acc;
    }, {});

  return flow([getDiffInformation, sortByLineNumber, groupByPath])(diffs);
};

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
