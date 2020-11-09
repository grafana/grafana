export interface ValueMatcherOptions {}

export interface BasicValueMatcherOptions<T> extends ValueMatcherOptions {
  value: T;
}

export interface RangeValueMatcherOptions<T> extends ValueMatcherOptions {
  from: T;
  to: T;
}
