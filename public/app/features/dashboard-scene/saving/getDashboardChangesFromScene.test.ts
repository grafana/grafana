import { MultiValueVariable, sceneGraph } from '@grafana/scenes';

import { buildPanelEditScene } from '../panel-edit/PanelEditor';
import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
import { findVizPanelByKey } from '../utils/utils';

import { getDashboardChangesFromScene } from './getDashboardChangesFromScene';

describe('getDashboardChangesFromScene', () => {
  it('Can detect no changes', () => {
    const dashboard = setup();
    const result = getDashboardChangesFromScene(dashboard, false);
    expect(result.hasChanges).toBe(false);
    expect(result.diffCount).toBe(0);
  });

  it('Can detect time changed', () => {
    const dashboard = setup();

    sceneGraph.getTimeRange(dashboard).setState({ from: 'now-1h', to: 'now' });

    const result = getDashboardChangesFromScene(dashboard, false);
    expect(result.hasChanges).toBe(false);
    expect(result.diffCount).toBe(0);
    expect(result.hasTimeChanges).toBe(true);
  });

  it('Can save time change', () => {
    const dashboard = setup();

    sceneGraph.getTimeRange(dashboard).setState({ from: 'now-1h', to: 'now' });

    const result = getDashboardChangesFromScene(dashboard, true);
    expect(result.hasChanges).toBe(true);
    expect(result.diffCount).toBe(1);
  });

  it('Can detect variable change', () => {
    const dashboard = setup();

    const appVar = sceneGraph.lookupVariable('app', dashboard) as MultiValueVariable;
    appVar.changeValueTo('app2');

    const result = getDashboardChangesFromScene(dashboard, false, false);

    expect(result.hasVariableValueChanges).toBe(true);
    expect(result.hasChanges).toBe(false);
    expect(result.diffCount).toBe(0);
  });

  it('Can save variable value change', () => {
    const dashboard = setup();

    const appVar = sceneGraph.lookupVariable('app', dashboard) as MultiValueVariable;
    appVar.changeValueTo('app2');

    const result = getDashboardChangesFromScene(dashboard, false, true);

    expect(result.hasVariableValueChanges).toBe(true);
    expect(result.hasChanges).toBe(true);
    expect(result.diffCount).toBe(2);
  });

  describe('Saving from panel edit', () => {
    it('Should commit panel edit changes', () => {
      const dashboard = setup();
      const panel = findVizPanelByKey(dashboard, 'panel-1')!;
      const editScene = buildPanelEditScene(panel);

      dashboard.onEnterEditMode();
      dashboard.setState({ editPanel: editScene });

      editScene.state.vizManager.state.panel.setState({ title: 'changed title' });
      editScene.commitChanges();

      const result = getDashboardChangesFromScene(dashboard, false, true);
      const panelSaveModel = result.changedSaveModel.panels![0];
      expect(panelSaveModel.title).toBe('changed title');
    });
  });
});

interface ScenarioOptions {
  fromPanelEdit?: boolean;
}

function setup(options: ScenarioOptions = {}) {
  const dashboard = transformSaveModelToScene({
    dashboard: {
      title: 'hello',
      uid: 'my-uid',
      schemaVersion: 30,
      panels: [
        {
          id: 1,
          title: 'Panel 1',
          type: 'text',
        },
      ],
      version: 10,
      templating: {
        list: [
          {
            name: 'app',
            type: 'custom',
            current: {
              text: 'app1',
              value: 'app1',
            },
          },
        ],
      },
    },
    meta: {},
  });

  const initialSaveModel = transformSceneToSaveModel(dashboard);
  dashboard.setInitialSaveModel(initialSaveModel);

  return dashboard;
}
