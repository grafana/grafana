import colors from 'app/core/utils/colors';
import { TimeSeries, TimeSeriesVMs } from 'app/types';

interface Options {
  timeSeries: TimeSeries[];
}

export function getTimeSeriesVMs({ timeSeries }: Options): TimeSeriesVMs {
  const vmSeries = timeSeries.map((item, index) => {
    const colorIndex = index % colors.length;
    const label = item.target;

    return {
      data: item.datapoints,
      label: label,
      color: colors[colorIndex],
    };
  });

  return vmSeries;
}
