/**
 * @alpha
 */

import { reportInteraction } from '../../analytics/utils';

import { Event, EventProperty } from './types';

export const defineFeatureEvents = (
  repo: Event['repo'] = 'grafana',
  feature: Event['feature'],
  defaultProps?: EventProperty
) => {
  return <P extends EventProperty | undefined = undefined>(eventName: string) =>
    (props: P extends undefined ? void : P) =>
      reportInteraction(`${repo}_${feature}_${eventName}`, { ...defaultProps, ...(props ?? undefined) });
};
