import { EchoBackend, EchoEventType } from '@grafana/runtime';
import { fromPairs, mapValues, sortBy } from 'lodash';
import { isLiveEvent, liveEventNames, PerformanceEvent } from './PerformanceBackend';

type IntervalStats = {
  time: number;
  count: number;
  min: number;
  max: number;
  avg: number;
};

type LivePerformanceBackendOptions = { maxIntervalsToKeep: number };

export class LivePerformanceBackend implements EchoBackend<PerformanceEvent, LivePerformanceBackendOptions> {
  supportedEvents = [EchoEventType.Performance];

  private buffer = emptyArrayByEventName<number>();
  private livePerformanceStats = emptyArrayByEventName<IntervalStats>();

  private currentIndexByEventName = fromPairs(liveEventNames.map((name) => [name, 0]));

  private constructor(public options: LivePerformanceBackendOptions) {}

  addEvent = (e: PerformanceEvent) => {
    if (isLiveEvent(e)) {
      const { name, value } = e.payload;
      this.buffer[name].push(value);
    }
  };

  flush = () => {
    Object.entries(this.buffer)
      .filter(([_, values]) => values.length)
      .forEach(([name, values]) => {
        const reduced = values.reduce(
          (acc, next) => {
            acc.sum += next;
            acc.max = Math.max(acc.max, next);
            acc.min = Math.min(acc.min, next);
            return acc;
          },
          { sum: 0, min: Number.MAX_SAFE_INTEGER, max: 0 }
        );

        const count = values.length;
        const index = this.currentIndexByEventName[name];
        this.livePerformanceStats[name][index] = {
          ...reduced,
          count,
          time: Date.now(),
          avg: reduced.sum / count,
        };
        this.currentIndexByEventName[name] = (index + 1) % this.options.maxIntervalsToKeep;
      });

    this.buffer = emptyArrayByEventName<number>();
  };

  static create = (options: LivePerformanceBackendOptions) => {
    if (!singletonInstance) {
      singletonInstance = new LivePerformanceBackend(options);
    }

    return singletonInstance;
  };

  getStats = () => mapValues(this.livePerformanceStats, (stats) => sortBy(stats, (v) => v.time));
}

const emptyArrayByEventName = <T>() =>
  liveEventNames.reduce((acc, next) => {
    acc[next] = [];
    return acc;
  }, {} as Record<string, T[]>);

let singletonInstance: LivePerformanceBackend | undefined;

export const getLivePerformanceBackend = () => singletonInstance;
