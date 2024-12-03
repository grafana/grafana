import { FlameChartViewPort } from './FlameChartViewPort';
import { FlameChartContainer } from './types';

export interface FlameChartProps<T> {
  container: FlameChartContainer<T>;
}

export function FlameChart<T>(props: FlameChartProps<T>) {
  const { container } = props;
  return <FlameChartViewPort container={container} />;
}
