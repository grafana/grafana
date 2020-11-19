export interface ValueMatcherOptions {}

export interface BasicValueMatcherOptions<T = any> extends ValueMatcherOptions {
  value: T;
}

export interface RangeValueMatcherOptions<T = any> extends ValueMatcherOptions {
  from: T;
  to: T;
}
