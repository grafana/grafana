import { DataQuery, PanelData } from '@grafana/data';

import { SceneItem } from './SceneItem';

export class SceneQueryRunner extends SceneItem<{ data: PanelData; queries: DataQuery[] }> {
  run() {}

  Component = () => null;
}
