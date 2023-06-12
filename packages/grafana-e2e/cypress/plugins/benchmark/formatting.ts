import { fromPairs } from 'lodash';

import { CollectedData, DataCollectorName } from './DataCollector';

type Stats = {
  sum: number;
  min: number;
  max: number;
  count: number;
  avg: number;
  time: number;
};

export enum MeasurementName {
  DataRenderDelay = 'DataRenderDelay',
}

type LivePerformanceAppStats = Record<MeasurementName, Stats[]>;

const isLivePerformanceAppStats = (data: CollectedData[]): data is LivePerformanceAppStats[] =>
  data.some((st) => {
    const stat = st?.[MeasurementName.DataRenderDelay];
    return Array.isArray(stat) && Boolean(stat?.length);
  });

type FormattedStats = {
  total: {
    count: number[];
    avg: number[];
  };
  lastInterval: {
    avg: number[];
    min: number[];
    max: number[];
    count: number[];
  };
};

export const formatAppStats = (allStats: CollectedData[]) => {
  if (!isLivePerformanceAppStats(allStats)) {
    return {};
  }

  const names = Object.keys(MeasurementName) as MeasurementName[];

  return fromPairs(
    names.map((name) => {
      const statsForMeasurement = allStats.map((s) => s[name]);
      const res: FormattedStats = {
        total: {
          count: [],
          avg: [],
        },
        lastInterval: {
          avg: [],
          min: [],
          max: [],
          count: [],
        },
      };

      statsForMeasurement.forEach((s) => {
        const total = s.reduce(
          (prev, next) => {
            prev.count += next.count;
            prev.avg += next.avg;
            return prev;
          },
          { count: 0, avg: 0 }
        );
        res.total.count.push(Math.round(total.count));
        res.total.avg.push(Math.round(total.avg / s.length));

        const lastInterval = s[s.length - 1];

        res.lastInterval.avg.push(Math.round(lastInterval?.avg));
        res.lastInterval.min.push(Math.round(lastInterval?.min));
        res.lastInterval.max.push(Math.round(lastInterval?.max));
        res.lastInterval.count.push(Math.round(lastInterval?.count));
      });

      return [name, res];
    })
  );
};

type CDPData = {
  eventCounts: Record<string, unknown>;
  fps: number;
  tracingDataLoss: number;
  warnings: Record<string, unknown>;
};

const isCDPData = (data: any[]): data is CDPData[] => data.every((d) => typeof d.eventCounts === 'object');

type FormattedCDPData = {
  minorGC: number[];
  majorGC: number[];
  droppedFrames: number[];
  fps: number[];
  tracingDataLossOccurred: boolean;
  longTaskWarnings: number[];
};

const emptyFormattedCDPData = (): FormattedCDPData => ({
  minorGC: [],
  majorGC: [],
  droppedFrames: [],
  fps: [],
  tracingDataLossOccurred: false,
  longTaskWarnings: [],
});

const formatCDPData = (data: any): FormattedCDPData => {
  if (!isCDPData(data)) {
    return emptyFormattedCDPData();
  }

  return data.reduce((acc, next) => {
    acc.majorGC.push((next.eventCounts.MajorGC as number) ?? 0);
    acc.minorGC.push((next.eventCounts.MinorGC as number) ?? 0);
    acc.fps.push(Math.round(next.fps) ?? 0);
    acc.tracingDataLossOccurred = acc.tracingDataLossOccurred || Boolean(next.tracingDataLoss);
    acc.droppedFrames.push((next.eventCounts.DroppedFrame as number) ?? 0);
    acc.longTaskWarnings.push((next.warnings.LongTask as number) ?? 0);
    return acc;
  }, emptyFormattedCDPData());
};

export const formatResults = (
  results: Array<{ appStats: CollectedData; collectorsData: CollectedData }>
): CollectedData => {
  return {
    ...formatAppStats(results.map(({ appStats }) => appStats)),
    ...formatCDPData(results.map(({ collectorsData }) => collectorsData[DataCollectorName.CDP])),

    __raw: results,
  };
};
