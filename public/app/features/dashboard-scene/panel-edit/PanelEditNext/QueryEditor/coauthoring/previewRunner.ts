import { type PanelData } from '@grafana/data';
import { type SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';

export function copyPanelData(data: PanelData): PanelData {
  const copyFrames = (frames: PanelData['series']): PanelData['series'] =>
    frames.map((frame) => ({
      ...frame,
      fields: frame.fields.map((field) => ({ ...field, values: field.values.slice() })),
    }));
  return { ...data, series: copyFrames(data.series), annotations: data.annotations && copyFrames(data.annotations) };
}

export function createPreviewRunner(canonical: SceneQueryRunner, queries: DataQuery[]): SceneQueryRunner {
  return canonical.clone({
    key: undefined,
    queries,
    data: undefined,
    _hasFetchedData: false,
    runQueriesMode: 'manual',
  });
}

export function attachPreviewRunner(panel: VizPanel, runner: SceneQueryRunner): void {
  panel.setState({ $behaviors: [...(panel.state.$behaviors ?? []), runner] });
}

export function detachPreviewRunner(panel: VizPanel, runner: SceneQueryRunner): void {
  runner.cancelQuery();
  // Datasource resolution may still be pending after cancellation.
  runner.setState({ queries: [] });
  panel.setState({ $behaviors: panel.state.$behaviors?.filter((behavior) => behavior !== runner) });
  runner.clearParent();
}
