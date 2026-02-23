type DataType = string | number | boolean | null | undefined;

export type EventProperty = {
  [key: string]: DataType | DataType[];
};
export interface Event {
  repo?: string;
  feature: string;
  eventName: string;
  description?: string;
  properties?: EventProperty[];
}
