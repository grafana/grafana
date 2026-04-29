/**
 * @alpha
 */

type DataType = string | number | boolean | null | undefined;

export type EventProperty = Record<string, DataType | DataType[]>;
export interface Event {
  repo?: string;
  feature: string;
  eventName: string;
  description?: string;
  properties?: EventProperty;
}
