import { of } from 'rxjs';

import { DataQueryRequest, DataSourceApi, PanelData, standardTransformersRegistry } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { setDataSourceSrv, setPluginImportUtils } from '@grafana/runtime';
import {
  LocalValueVariable,
  SceneGridItem,
  SceneGridLayout,
  SceneGridRow,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';
import { LoadingState } from '@grafana/schema';
import { mockDataSource, MockDataSourceSrv } from 'app/features/alerting/unified/mocks';
import { reduceTransformRegistryItem } from 'app/features/transformers/editors/ReduceTransformerEditor';

import repeatingRowsAndPanelsDashboardJson from '../serialization/testfiles/repeating_rows_and_panels.json';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { activateFullSceneTree } from '../utils/test-utils';

import { DashboardScene } from './DashboardScene';
import { ViewPanelScene } from './ViewPanelScene';

describe('ViewPanelScene', () => {
  it('Should build scene on activate', () => {
    const { viewPanelScene } = buildScene();
    viewPanelScene.activate();
    expect(viewPanelScene.state.body).toBeDefined();
  });

  it('Should look copy row variable scope', () => {
    const { viewPanelScene } = buildScene({ rowVariables: true, panelVariables: true });
    viewPanelScene.activate();

    const variables = viewPanelScene.state.body?.state.$variables;
    expect(variables?.state.variables.length).toBe(2);
  });
});

interface SceneOptions {
  rowVariables?: boolean;
  panelVariables?: boolean;
}

function buildScene(options?: SceneOptions) {
  // builds a scene how it looks like after row and panel repeats are processed
  const panel = new VizPanel({
    key: 'panel-22',
    $variables: options?.panelVariables
      ? new SceneVariableSet({
          variables: [new LocalValueVariable({ value: 'panel-var-value' })],
        })
      : undefined,
  });

  const dashboard = new DashboardScene({
    body: new SceneGridLayout({
      children: [
        new SceneGridRow({
          x: 0,
          y: 10,
          width: 24,
          $variables: options?.rowVariables
            ? new SceneVariableSet({
                variables: [new LocalValueVariable({ value: 'row-var-value' })],
              })
            : undefined,
          height: 1,
          children: [
            new SceneGridItem({
              body: panel,
            }),
          ],
        }),
      ],
    }),
  });

  const viewPanelScene = new ViewPanelScene({ panelRef: panel.getRef() });

  return { viewPanelScene, dashboard };
}
