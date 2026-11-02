/**
 * @alpha
 */

type DataType = string | number | boolean | null | undefined;

export type EventProperty = Record<string, DataType | DataType[]>;

// Extracts only the declared literal keys, stripping any string index signature
type KnownKeys<T> = keyof { [K in keyof T as string extends K ? never : K]: T[K] };

export type Exact<Base extends EventProperty, Arg extends Base> = {
  [K in keyof Arg]: K extends KnownKeys<Base> ? Arg[K] : never;
};

/**
 * Declares an event whose properties vary by variant, with the shared properties documented once
 * on `Base`. Use this instead of constraining the union yourself: it distributes over `Variants`
 * so each one intersects `Base`, which keeps `Base`'s JSDoc attached to every variant. The
 * analytics report reads descriptions off the variants, so a base that is only a constraint
 * (`type Constrained<B, T extends B> = T`) leaves every shared property undocumented.
 *
 *   type Base = { \/** Which widget fired. *\/ surface: string };
 *   type Clicked = EventVariants<Base, { surface: 'card' } | { surface: 'pill' }>;
 */
export type EventVariants<Base extends EventProperty, Variants extends Base> = Variants extends unknown
  ? Base & Variants
  : never;
export interface Event {
  repo?: string;
  feature: string;
  eventName: string;
  description?: string;
  properties?: EventProperty;
}

/**
 * Factory-level options for {@link defineFeatureEvents}. `silent: true` marks
 * every event produced by the factory as silent — dispatched to {@link EchoSrv}
 * subscribers but not forwarded to analytics backends. Use for high-frequency
 * UI signals that downstream subscribers (e.g. CUJ instrumentation) care about
 * but shouldn't pollute the analytics stream.
 */
export interface DefineFeatureEventsOptions {
  silent?: boolean;
}
