import { isNumber } from 'lodash';

import { isDateTimeInput, dateTime } from '../datetime/moment_wrapper';
import { Field, FieldType } from '../types/dataFrame';

type IndexComparer = (a: number, b: number) => number;

export const fieldIndexComparer = (field: Field, reverse = false): IndexComparer => {
  const values = field.values;

  switch (field.type) {
    case FieldType.number:
      return numericIndexComparer(values, reverse);
    case FieldType.string:
      return stringIndexComparer(values, reverse);
    case FieldType.boolean:
      return booleanIndexComparer(values, reverse);
    case FieldType.time:
      if (typeof field.values[0] === 'number') {
        return timestampIndexComparer(values, reverse);
      }
      return timeIndexComparer(values, reverse);
    default:
      return naturalIndexComparer(reverse);
  }
};

const timeComparer = (a: unknown, b: unknown): number => {
  if (!a || !b) {
    return falsyComparer(a, b);
  }

  if (isNumber(a) && isNumber(b)) {
    return numericComparer(a, b);
  }

  if (isDateTimeInput(a) && isDateTimeInput(b)) {
    if (dateTime(a).isBefore(b)) {
      return -1;
    }

    if (dateTime(b).isBefore(a)) {
      return 1;
    }
  }

  return 0;
};

const numericComparer = (a: number, b: number): number => {
  return a - b;
};

const stringComparer = (a: string, b: string): number => {
  if (!a || !b) {
    return falsyComparer(a, b);
  }
  return a.localeCompare(b);
};

const booleanComparer = (a: boolean, b: boolean): number => {
  return falsyComparer(a, b);
};

const falsyComparer = (a: unknown, b: unknown): number => {
  if (!a && b) {
    return 1;
  }

  if (a && !b) {
    return -1;
  }

  return 0;
};

const timestampIndexComparer = (values: number[], reverse: boolean): IndexComparer => {
  let mult = reverse ? -1 : 1;
  return (a: number, b: number): number => mult * (values[a] - values[b]);
};

const timeIndexComparer = (values: unknown[], reverse: boolean): IndexComparer => {
  return (a: number, b: number): number => {
    const vA = values[a];
    const vB = values[b];
    return reverse ? timeComparer(vB, vA) : timeComparer(vA, vB);
  };
};

const booleanIndexComparer = (values: boolean[], reverse: boolean): IndexComparer => {
  return (a: number, b: number): number => {
    const vA = values[a];
    const vB = values[b];
    return reverse ? booleanComparer(vB, vA) : booleanComparer(vA, vB);
  };
};

const numericIndexComparer = (values: number[], reverse: boolean): IndexComparer => {
  return (a: number, b: number): number => {
    const vA = values[a];
    const vB = values[b];
    return reverse ? numericComparer(vB, vA) : numericComparer(vA, vB);
  };
};

const stringIndexComparer = (values: string[], reverse: boolean): IndexComparer => {
  return (a: number, b: number): number => {
    const vA = values[a];
    const vB = values[b];
    return reverse ? stringComparer(vB, vA) : stringComparer(vA, vB);
  };
};

const naturalIndexComparer = (reverse: boolean): IndexComparer => {
  return (a: number, b: number): number => {
    return reverse ? numericComparer(b, a) : numericComparer(a, b);
  };
};
