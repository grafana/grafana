export interface StartFlowPayload {
  flowId: string;
  storyId: string;
}

export interface EmitEventPayload {
  event: string;
  params: Record<string, string>;
}

export const { startFlow, emitEvent } = {
  startFlow: (flowId: string, storyId: string) => {
    return {
      type: 'userFlow/startFlow',
      payload: {
        flowId,
        storyId,
      },
    };
  },
  emitEvent: (event: string, params: { [key: string]: string } = {}) => {
    return {
      type: 'userFlow/emitEvent',
      payload: {
        event,
        params,
      },
    };
  },
};
