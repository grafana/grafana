import colors from 'app/core/utils/colors';
import { TimeSeries, TimeSeriesViewModel } from 'app/types';

interface Options {
  ts: TimeSeries;
  seriesIndex: number;
}

export function getTimeSeriesViewModel(ts: TimeSeries): TimeSeriesViewModel {}
