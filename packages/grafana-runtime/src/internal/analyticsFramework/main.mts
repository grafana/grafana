import { reportInteraction } from "src/analytics/utils";
import { Event, EventProperty } from "./types.mts";

export const createInteractionEvent = (repo: Event['repo'] = 'grafana', feature: Event['feature'], eventName: Event['eventName']) => {
    return <P extends EventProperty | undefined = undefined>(eventName: string) =>
    (props: P extends undefined ? void : P) =>
      reportInteraction(`${repo}_${feature}_${eventName}`, props ?? undefined);
};