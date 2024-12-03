import { GrafanaTheme2 } from '@grafana/data';

export interface Operation<T> {
  startMs: number;
  durationMs: number;
  entity: T;
  parent?: Operation<T>;
  children: Array<Operation<T>>;
}

export interface FlameChartContainer<T> {
  operations: Array<Operation<T>>;
  getOperationId: (operation: T) => string;
  getOperationName: (operation: T) => string;
  getNodeBackgroundColor: (operation: T, theme: GrafanaTheme2) => string;
}

export interface RenderItem<T> {
  operation: Operation<T>;
  width: number;
  x: number;
  y: number;
}

export interface RenderContainer<T> {
  fromMs: number;
  toMs: number;
  items: Array<RenderItem<T>>;
}
