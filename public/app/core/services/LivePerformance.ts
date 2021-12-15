import config from 'app/core/config';

import { fromPairs, mapValues, sortBy } from 'lodash';

type IntervalStats = {
  time: number;
  count: number;
  min: number;
  max: number;
  avg: number;
};

type LivePerformanceOptions = { maxIntervalsToKeep: number; intervalDuration: number };

export enum MeasurementName {
  DataRenderDelay = 'DataRenderDelay',
}

const measurementNames = Object.keys(MeasurementName);

export class LivePerformance {
  private buffer = emptyArrayByEventName<number>();
  private livePerformanceStats = emptyArrayByEventName<IntervalStats>();

  private currentIndexByEventName = fromPairs(measurementNames.map((name) => [name, 0]));

  private constructor(public options: LivePerformanceOptions) {
    setInterval(this.calculateStatsForCurrentInterval, options.intervalDuration);
  }

  add = (name: MeasurementName, value: number) => {
    this.buffer[name].push(value);
  };

  calculateStatsForCurrentInterval = () => {
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

  static initialize = (options: LivePerformanceOptions) => {
    if (LivePerformance.shouldInitialize()) {
      singletonInstance = new LivePerformance(options);
    }
  };

  static instance = () => {
    return singletonInstance;
  };

  static shouldInitialize = () => !singletonInstance && LivePerformance.isEnabled();

  static isEnabled = () => config.livePerformance.measureDataRenderDelay;

  getStats = () => mapValues(this.livePerformanceStats, (stats) => sortBy(stats, (v) => v.time));
}

const emptyArrayByEventName = <T>() =>
  measurementNames.reduce((acc, next) => {
    acc[next] = [];
    return acc;
  }, {} as Record<string, T[]>);

let singletonInstance: LivePerformance | undefined;
