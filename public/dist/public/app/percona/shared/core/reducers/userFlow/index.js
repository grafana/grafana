export const { startFlow, emitEvent } = {
    startFlow: (flowId, storyId) => {
        return {
            type: 'userFlow/startFlow',
            payload: {
                flowId,
                storyId,
            },
        };
    },
    emitEvent: (event, params = {}) => {
        return {
            type: 'userFlow/emitEvent',
            payload: {
                event,
                params,
            },
        };
    },
};
//# sourceMappingURL=index.js.map