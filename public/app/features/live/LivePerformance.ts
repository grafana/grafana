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
  DashboardRenderBudgetExceeded = 'DashboardRenderBudgetExceeded',
}

const measurementNames = Object.keys(MeasurementName);

export class LivePerformance {
  private options = LivePerformance.optionsWithDefaults();
  private state = LivePerformance.emptyState();

  static optionsWithDefaults = (opt?: Partial<LivePerformanceOptions>): LivePerformanceOptions => ({
    maxIntervalsToKeep: opt?.maxIntervalsToKeep ?? 10,
    intervalDuration: opt?.intervalDuration ?? 10000,
  });

  static emptyState = () => ({
    buffer: emptyArrayByEventName<number>(),
    livePerformanceStats: emptyArrayByEventName<IntervalStats>(),
    currentIndexByEventName: fromPairs(measurementNames.map((name) => [name, 0])),
    running: false,
    intervalId: undefined as undefined | ReturnType<typeof setInterval>,
  });

  isRunning = () => this.state.running;

  start = (options?: Partial<LivePerformanceOptions>) => {
    if (!LivePerformance.isEnabled()) {
      console.warn('live performance is not enabled');
      return false;
    }

    if (this.state.running) {
      console.warn('live performance collection is already running');
      return true;
    }

    this.options = LivePerformance.optionsWithDefaults(options);
    this.state.intervalId = setInterval(this.calculateStatsForCurrentInterval, this.options.intervalDuration);
    this.state.running = true;
    return true;
  };

  stopAndGetStats = () => {
    if (!this.state.running || !this.state.intervalId) {
      console.warn('live performance was not started');
      return;
    }

    clearInterval(this.state.intervalId);

    const stats = mapValues(this.state.livePerformanceStats, (stats) => sortBy(stats, (v) => v.time));
    this.state = LivePerformance.emptyState();
    return stats;
  };

  add = (name: MeasurementName, value: number | (() => number)) => {
    if (this.isRunning()) {
      this.state.buffer[name].push(typeof value === 'number' ? value : value());
    }
  };

  calculateStatsForCurrentInterval = () => {
    Object.entries(this.state.buffer)
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
        const index = this.state.currentIndexByEventName[name];
        this.state.livePerformanceStats[name][index] = {
          ...reduced,
          count,
          time: Date.now(),
          avg: reduced.sum / count,
        };
        this.state.currentIndexByEventName[name] = (index + 1) % this.options.maxIntervalsToKeep;
      });
  };

  static instance = () => singleton;

  static isEnabled = () => true;
}

const emptyArrayByEventName = <T>() =>
  measurementNames.reduce((acc, next) => {
    acc[next] = [];
    return acc;
  }, {} as Record<string, T[]>);

const singleton = new LivePerformance();
