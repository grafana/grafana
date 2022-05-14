import { DataQuery, PanelData } from '@grafana/data';

import { SceneItemBase } from './SceneItem';

export class SceneQueryRunner extends SceneItemBase<{ data: PanelData; queries: DataQuery[] }> {
  run() {}

  Component = () => null;
}
