/**
 * @alpha
 */

import { reportInteraction } from '../../analytics/utils';

import { Event, EventProperty } from './types';

export const createInteractionEvent = (repo: Event['repo'] = 'grafana', feature: Event['feature']) => {
  return <P extends EventProperty | undefined = undefined>(eventName: string) =>
    (props: P extends undefined ? void : P) =>
      reportInteraction(`${repo}_${feature}_${eventName}`, props ?? undefined);
};
