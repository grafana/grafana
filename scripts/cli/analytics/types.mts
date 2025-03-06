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
  name: string;
  description: string;
  owner?: string;
  properties?: EventProperty[];
}
