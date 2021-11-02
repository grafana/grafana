import { Observable, asyncScheduler } from 'rxjs';
/**
 * Creates an Observable that emits sequential numbers after increasing intervals of time
 * starting with `startPeriod`, ending with `endPeriod` and incrementing by `step`.
 */
export var increasingInterval = function (_a, scheduler) {
    var _b = _a.startPeriod, startPeriod = _b === void 0 ? 0 : _b, _c = _a.endPeriod, endPeriod = _c === void 0 ? 5000 : _c, _d = _a.step, step = _d === void 0 ? 1000 : _d;
    if (scheduler === void 0) { scheduler = asyncScheduler; }
    return new Observable(function (subscriber) {
        subscriber.add(scheduler.schedule(dispatch, startPeriod, { subscriber: subscriber, counter: 0, period: startPeriod, step: step, endPeriod: endPeriod }));
        return subscriber;
    });
};
function dispatch(state) {
    var subscriber = state.subscriber, counter = state.counter, period = state.period, step = state.step, endPeriod = state.endPeriod;
    subscriber.next(counter);
    var newPeriod = Math.min(period + step, endPeriod);
    this.schedule({ subscriber: subscriber, counter: counter + 1, period: newPeriod, step: step, endPeriod: endPeriod }, newPeriod);
}
//# sourceMappingURL=increasingInterval.js.map