import { compare, Operation } from 'fast-json-patch';
// @ts-ignore
import jsonMap from 'json-source-map';
import _ from 'lodash';

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

      const path = _.tail(diff.path.split('/'));

      if (diff.op === 'replace') {
        originalValue = _.get(lhs, path);
        value = diff.value;
        startLineNumber = rhsMap.pointers[diff.path].value.line;
      }
      if (diff.op === 'add') {
        value = diff.value;
        startLineNumber = rhsMap.pointers[diff.path].value.line;
      }
      if (diff.op === 'remove') {
        originalValue = _.get(lhs, path);
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

  const sortByLineNumber = (diffs: Diff[]) => _.sortBy(diffs, 'startLineNumber');
  const groupByPath = (diffs: Diff[]) =>
    diffs.reduce<Record<string, any>>((acc, value) => {
      const groupKey: string = value.path[0];
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(value);
      return acc;
    }, {});

  return _.flow([getDiffInformation, sortByLineNumber, groupByPath])(diffs);
};

export const getDiffText = (diff: Diff, showProp = true) => {
  let text = getDiffOperationText(diff.op);
  const prop = _.last(diff.path)!;

  if (diff.op === 'add' || diff.op === 'remove') {
    const val = diff.op === 'add' ? diff.value : diff.originalValue;

    if (_.isArray(val)) {
      if (!_.isEmpty(val)) {
        text += isNumeric(prop) ? ` item ${prop}` : ` ${val.length} ${prop}`;
      } else {
        text += ` ${prop}`;
      }
    } else {
      text += isNumeric(prop) ? ` item ${prop}` : ` ${prop}`;
    }
  } else {
    if (showProp) {
      text += isNumeric(prop) ? ` item ${prop}` : ` ${prop}`;
    }
  }
  return text;
};

const isNumeric = (value: string) => !_.isNaN(_.toNumber(value));

export const getDiffOperationText = (operation: string): string => {
  if (operation === 'add') {
    return 'added';
  }
  if (operation === 'remove') {
    return 'deleted';
  }
  return 'changed';
};
