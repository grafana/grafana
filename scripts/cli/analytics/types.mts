/**
 * @alpha
 */

type DataType = string | number | boolean | null | undefined;

export type EventProperty = Record<string, DataType | DataType[]>;

export interface EventPropertySchema {
  name: string;
  type: string;
  description?: string;
}
export interface Event {
  repo?: string;
  feature: string;
  eventName: string;
  description?: string;
  properties?: EventProperty;
}

// Intermediate type used in findAllEvents to map factory names → their namespace
export interface EventNamespace {
  factoryName: string;
  eventPrefixProject: string;
  eventPrefixFeature: string;
  // Properties that are merged into every event in this namespace via the third
  // argument of defineFeatureEvents (e.g. { schema_version: 1 })
  defaultProperties?: EventPropertySchema[];
  // Factory-level silent setting from the fourth argument of defineFeatureEvents.
  // Every event from this factory inherits this unless overridden per-event.
  silent?: boolean;
}

// The full event descriptor produced by the script
export interface EventData extends Omit<Event, 'properties'> {
  fullEventName: string;
  owner?: string;
  properties?: EventPropertySchema[];
  // One entry per variant for events whose properties are a discriminated union, in declaration
  // order. `properties` flattens these into one row per name, which reads as though every value of
  // one property pairs with every value of another; these preserve which combinations are valid.
  variants?: EventPropertySchema[][];
  // Silent events are dispatched to EchoSrv subscribers but not forwarded to
  // analytics backends (e.g. Rudderstack). Resolved from per-event options
  // first, falling back to the factory-level setting.
  silent?: boolean;
}

export interface JSDocMetadata {
  description?: string;
  owner?: string;
}
