/* eslint-disable @typescript-eslint/consistent-type-assertions,@typescript-eslint/no-explicit-any */

import { EmitEventPayload, StartFlowPayload } from 'app/percona/shared/core/reducers/userFlow';
import { EventStore } from 'app/percona/ui-events/EventStore';
import { Action } from 'app/percona/ui-events/reducer';

export interface UserFlowState {
  flowId: string | null;
  storyId: string | null;
}

const initialState: UserFlowState = {
  flowId: null,
  storyId: null,
};

export interface UserFlowEvent {
  // Unique ID of user flow. For example, user's attempt to connect to portal.
  // This ID will be generated in the beginning of the journey. It will be the same across all steps.
  flow_id: string;
  // Type of user flow. For example, "connect to portal".
  story_id: string;
  // Logical step in the journey, step of the flow. All steps in the flow share same flowId.
  event: string;
  // Optional params, that help in user's journey analysis.
  params: Record<string, string>;
}

export const processUserFlowEvent = (state: UserFlowState = initialState, action: Action): UserFlowState => {
  if (!action.type.startsWith('userFlow/')) {
    return state;
  }
  if (action.type.indexOf('startFlow') > -1) {
    const payload = action.payload as StartFlowPayload;
    return {
      ...state,
      flowId: payload.flowId,
      storyId: payload.storyId,
    };
  }
  if (action.type.indexOf('emitEvent') > -1) {
    const payload = action.payload as EmitEventPayload;

    const event: UserFlowEvent = {
      flow_id: state.flowId || '???',
      story_id: state.storyId || '???',
      event: payload.event,
      params: payload.params,
    };
    EventStore.userFlowEvents.push(event);

    return state;
  }
  console.warn(action.type, 'is not supported');
  return state;
};
