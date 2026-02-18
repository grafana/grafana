export type EventProperty = {
    [key: string]: string | number | boolean | undefined;
}

export interface Event {
    repo?: string;
    feature: string;
    eventName: string;
    description?: string;
    properties?: EventProperty[];
}