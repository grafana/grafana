class _EventStore {
    constructor() {
        this.dashboardUsage = [];
        this.fetching = [];
        this.notificationErrors = [];
        this.userFlowEvents = [];
    }
    isNotEmpty() {
        return !this.isEmpty();
    }
    isEmpty() {
        return (this.dashboardUsage.length === 0 &&
            this.fetching.length === 0 &&
            this.notificationErrors.length === 0 &&
            this.userFlowEvents.length === 0);
    }
    clear() {
        this.dashboardUsage = [];
        this.fetching = [];
        this.notificationErrors = [];
        this.userFlowEvents = [];
    }
}
export const EventStore = new _EventStore();
//# sourceMappingURL=EventStore.js.map