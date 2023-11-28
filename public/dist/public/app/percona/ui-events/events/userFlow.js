/* eslint-disable @typescript-eslint/consistent-type-assertions,@typescript-eslint/no-explicit-any */
import { EventStore } from 'app/percona/ui-events/EventStore';
const initialState = {
    flowId: null,
    storyId: null,
};
export const processUserFlowEvent = (state = initialState, action) => {
    if (!action.type.startsWith('userFlow/')) {
        return state;
    }
    if (action.type.indexOf('startFlow') > -1) {
        const payload = action.payload;
        return Object.assign(Object.assign({}, state), { flowId: payload.flowId, storyId: payload.storyId });
    }
    if (action.type.indexOf('emitEvent') > -1) {
        const payload = action.payload;
        const event = {
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
//# sourceMappingURL=userFlow.js.map