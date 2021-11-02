import { SchedulerLike, Observable, SchedulerAction, Subscriber, asyncScheduler } from 'rxjs';

/**
 * Creates an Observable that emits sequential numbers after increasing intervals of time
 * starting with `startPeriod`, ending with `endPeriod` and incrementing by `step`.
 */
export const increasingInterval = (
  { startPeriod = 0, endPeriod = 5000, step = 1000 },
  scheduler: SchedulerLike = asyncScheduler
): Observable<number> => {
  return new Observable<number>((subscriber) => {
    const state: IntervalState = {
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

function dispatch(this: SchedulerAction<IntervalState>, state?: IntervalState) {
  if (!state) {
    return;
  }
  const { subscriber, counter, period, step, endPeriod } = state;
  subscriber.next(counter);
  const newPeriod = Math.min(period + step, endPeriod);
  this.schedule({ subscriber, counter: counter + 1, period: newPeriod, step, endPeriod }, newPeriod);
}

interface IntervalState {
  subscriber: Subscriber<number>;
  counter: number;
  period: number;
  endPeriod: number;
  step: number;
}
