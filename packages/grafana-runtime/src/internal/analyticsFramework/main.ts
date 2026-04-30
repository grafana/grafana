/**
 * @alpha
 */

import { reportInteraction } from '../../analytics/utils';

import { type DefineFeatureEventsOptions, type Exact, type Event, type EventProperty } from './types';

export const defineFeatureEvents = (
  repo: Event['repo'] = 'grafana',
  feature: Event['feature'],
  defaultProps?: EventProperty,
  options?: DefineFeatureEventsOptions
) => {
  return <P extends EventProperty | undefined = undefined>(eventName: string) =>
    <A extends P extends EventProperty ? P : never>(props: P extends EventProperty ? Exact<P, A> : void) =>
      reportInteraction(
        `${repo}_${feature}_${eventName}`,
        { ...defaultProps, ...(props ?? undefined) },
        options?.silent ? { silent: true } : undefined
      );
};
