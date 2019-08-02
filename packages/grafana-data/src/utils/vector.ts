import { Vector } from '../types/dataFrame';

interface ConstantOptions<T = any> {
  length: number;
  value: T;
}

const constantHandler = {
  get: (obj: ConstantOptions, prop: any) => {
    if ('length' === prop) {
      return obj.length;
    }
    return obj.value;
  },
};

export function createConstantVector<T>(options: ConstantOptions<T>): Vector<T> {
  const proxy = new Proxy(options, constantHandler);
  const v = (proxy as unknown) as Vector<T>;
  v.push = (...items: T[]) => v.length;
  return v;
}

interface ScaleOptions {
  source: Vector<number>;
  scale: number;
}

// function asNumber(prop: any): number {
//   if (isNumber(prop)) {
//     return prop as number;
//   }
//   if (isString(prop)) {
//     return parseInt(prop, 10);
//   }
//   return NaN;
// }

const scaleHandler = {
  get: (obj: ScaleOptions, prop: any) => {
    if ('length' === prop) {
      return obj.source.length;
    }
    const v = obj.source[prop];
    return v * obj.scale;
  },
};

export function createScaledVector(options: ScaleOptions): Vector<number> {
  const proxy = new Proxy(options, scaleHandler);
  const v = (proxy as unknown) as Vector<number>;
  v.push = (...items: number[]) => v.length;
  return v;
}
