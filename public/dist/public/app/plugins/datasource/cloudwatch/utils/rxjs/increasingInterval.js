import { Observable, asyncScheduler } from 'rxjs';
/**
 * Creates an Observable that emits sequential numbers after increasing intervals of time
 * starting with `startPeriod`, ending with `endPeriod` and incrementing by `step`.
 */
export const increasingInterval = ({ startPeriod = 0, endPeriod = 5000, step = 1000 }, scheduler = asyncScheduler) => {
    return new Observable((subscriber) => {
        const state = {
            subscriber,
            counter: 0,
            period: startPeriod,
            step,
            endPeriod,
        };
        subscriber.add(scheduler.schedule(dispatch, startPeriod, state));
        return subscriber;
    });
};
function dispatch(state) {
    if (!state) {
        return;
    }
    const { subscriber, counter, period, step, endPeriod } = state;
    subscriber.next(counter);
    const newPeriod = Math.min(period + step, endPeriod);
    this.schedule({ subscriber, counter: counter + 1, period: newPeriod, step, endPeriod }, newPeriod);
}
//# sourceMappingURL=increasingInterval.js.map