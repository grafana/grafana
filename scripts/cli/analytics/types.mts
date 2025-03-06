export interface EventNamespace {
  factoryName: string;
  eventPrefixProject: string;
  eventPrefixFeature: string;
}

export interface EventProperty {
  name: string;
  type: string;
  description?: string;
}

export interface Event {
  fullEventName: string;
  eventProject: string;
  eventFeature: string;
  eventName: string;

  description: string;
  owner?: string;
  properties?: EventProperty[];
}
