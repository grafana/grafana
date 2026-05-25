import { getDataSourceSrv } from '@grafana/runtime';
import { type SceneObject, VizPanel, sceneGraph } from '@grafana/scenes';

import { getQueryRunnerFor } from './utils';

export function hasStreamingDataSource(root: SceneObject): boolean {
  const srv = getDataSourceSrv();
  const panels: VizPanel[] = [];
  sceneGraph.findAllObjects(root, (obj) => {
    if (obj instanceof VizPanel) {
      panels.push(obj);
    }
    return false;
  });

  for (const panel of panels) {
    const runner = getQueryRunnerFor(panel);
    if (!runner) {
      continue;
    }

    const defaultRef = runner.state.datasource;
    for (const query of runner.state.queries) {
      const ref = query.datasource ?? defaultRef;
      if (!ref) {
        continue;
      }
      if (srv.getInstanceSettings(ref)?.meta?.streaming) {
        return true;
      }
    }
  }

  return false;
}
