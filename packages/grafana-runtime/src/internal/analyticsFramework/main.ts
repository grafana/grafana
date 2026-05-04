/**
 * @alpha
 */

import { reportInteraction } from '../../analytics/utils';

import { type DefineFeatureEventsOptions, type Exact, type Event, type EventProperty } from './types';

export const defineFeatureEvents = (
  repo: Event['repo'] = 'grafana',
  feature: Event['feature'],
  defaultProps?: EventProperty,
  factoryOptions?: DefineFeatureEventsOptions
) => {
  return <P extends EventProperty | undefined = undefined>(
      eventName: string,
      eventOptions?: DefineFeatureEventsOptions
    ) =>
    <A extends P extends EventProperty ? P : never>(props: P extends EventProperty ? Exact<P, A> : void) => {
      // Per-event silent overrides factory-level silent so a single factory
      // can mix loud (analytics) and silent (CUJ-internal) events.
      const silent = eventOptions?.silent ?? factoryOptions?.silent ?? false;
      reportInteraction(
        `${repo}_${feature}_${eventName}`,
        { ...defaultProps, ...(props ?? undefined) },
        silent ? { silent: true } : undefined
      );
    };
};
