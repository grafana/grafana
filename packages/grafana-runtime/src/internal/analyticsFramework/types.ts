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
}

// The full event descriptor produced by the script
export interface EventData extends Omit<Event, 'properties'> {
  fullEventName: string;
  owner?: string;
  properties?: EventPropertySchema[];
}
