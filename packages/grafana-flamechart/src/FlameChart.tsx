import { FlameChartViewPort } from './FlameChartViewPort';
import { FlameChartContainer, ViewRange } from './types';

export interface FlameChartProps<T> {
  container: FlameChartContainer<T>;
  viewRange: ViewRange;
}

export function FlameChart<T>(props: FlameChartProps<T>) {
  return <FlameChartViewPort {...props} />;
}
