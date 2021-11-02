export var store;
export function setStore(newStore) {
    store = newStore;
}
export function getState() {
    if (!store || !store.getState) {
        return {
            templating: {
                variables: {},
            },
        }; // used by tests
    }
    return store.getState();
}
export function dispatch(action) {
    if (!store || !store.getState) {
        return;
    }
    return store.dispatch(action);
}
//# sourceMappingURL=store.js.map