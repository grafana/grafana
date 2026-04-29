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
}

// The full event descriptor produced by the script
export interface EventData extends Omit<Event, 'properties'> {
  fullEventName: string;
  owner?: string;
  properties?: EventPropertySchema[];
}

export interface JSDocMetadata {
  description?: string;
  owner?: string;
}
