import { fromPairs, mapValues, sortBy } from 'lodash';
import { PerformanceMetricName } from '@grafana/ui';

type IntervalStats = {
  time: number;
  count: number;
  min: number;
  max: number;
  avg: number;
};

type Options = { maxIntervalsToKeep: number; intervalDuration: number };

const measurementNames = Object.values(PerformanceMetricName);

export class PerformanceMetrics {
  private options = PerformanceMetrics.optionsWithDefaults();
  private state = PerformanceMetrics.emptyState();

  static optionsWithDefaults = (opt?: Partial<Options>): Options => ({
    maxIntervalsToKeep: opt?.maxIntervalsToKeep ?? 10,
    intervalDuration: opt?.intervalDuration ?? 10000,
  });

  static emptyState = () => ({
    buffer: emptyArrayByEventName<number>(),
    performanceStats: emptyArrayByEventName<IntervalStats>(),
    currentIndexByEventName: fromPairs(measurementNames.map((name) => [name, 0])),
    running: false,
    intervalId: undefined as undefined | ReturnType<typeof setInterval>,
  });

  enabled = () => this.state.running;

  start = (options?: Partial<Options>) => {
    if (!PerformanceMetrics.isEnabled()) {
      console.warn('Performance metric collection is not enabled');
      return false;
    }

    if (this.state.running) {
      console.warn('Performance metric collection is already running');
      return true;
    }

    this.options = PerformanceMetrics.optionsWithDefaults(options);
    this.state.intervalId = setInterval(this.calculateStatsForCurrentInterval, this.options.intervalDuration);
    this.state.running = true;
    return true;
  };

  stopAndGetStats = () => {
    if (!this.state.running || !this.state.intervalId) {
      console.warn('Performance metric collection was not started');
      return;
    }

    clearInterval(this.state.intervalId);

    const stats = mapValues(this.state.performanceStats, (stats) => sortBy(stats, (v) => v.time));
    this.state = PerformanceMetrics.emptyState();
    return stats;
  };

  add = (name: PerformanceMetricName, value: number | (() => number)) => {
    if (this.enabled()) {
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
        this.state.performanceStats[name][index] = {
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

const singleton = new PerformanceMetrics();
