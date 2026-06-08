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
