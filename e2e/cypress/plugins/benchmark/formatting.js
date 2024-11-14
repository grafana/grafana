const { fromPairs } = require('lodash');

const isLivePerformanceAppStats = (data) =>
  data.some((st) => {
    const stat = st?.[MeasurementName.DataRenderDelay];
    return Array.isArray(stat) && Boolean(stat?.length);
  });

const formatAppStats = (allStats) => {
  if (!isLivePerformanceAppStats(allStats)) {
    return {};
  }

  const names = Object.keys(MeasurementName);

  return fromPairs(
    names.map((name) => {
      const statsForMeasurement = allStats.map((s) => s[name]);
      const res = {
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

const emptyFormattedCDPData = () => ({
  minorGC: [],
  majorGC: [],
  droppedFrames: [],
  fps: [],
  tracingDataLossOccurred: false,
  longTaskWarnings: [],
});

const isCDPData = (data) => data.every((d) => typeof d.eventCounts === 'object');

const formatCDPData = (data) => {
  if (!isCDPData(data)) {
    return emptyFormattedCDPData();
  }

  return data.reduce((acc, next) => {
    acc.majorGC.push(next.eventCounts.MajorGC ?? 0);
    acc.minorGC.push(next.eventCounts.MinorGC ?? 0);
    acc.fps.push(Math.round(next.fps) ?? 0);
    acc.tracingDataLossOccurred = acc.tracingDataLossOccurred || Boolean(next.tracingDataLoss);
    acc.droppedFrames.push(next.eventCounts.DroppedFrame ?? 0);
    acc.longTaskWarnings.push(next.warnings.LongTask ?? 0);
    return acc;
  }, emptyFormattedCDPData());
};

const formatResults = (results) => {
  return {
    ...formatAppStats(results.map(({ appStats }) => appStats)),
    ...formatCDPData(results.map(({ collectorsData }) => collectorsData[DataCollectorName.CDP])),

    __raw: results,
  };
};

exports.formatResults = formatResults;
exports.formatAppStats = formatAppStats;
