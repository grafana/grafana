import { MultiValueVariable, sceneGraph } from '@grafana/scenes';

import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
import { transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';

import { getSaveDashboardChange } from './getSaveDashboardChange';

describe('getSaveDashboardChange', () => {
  it('Can detect no changes', () => {
    const dashboard = setup();
    const result = getSaveDashboardChange(dashboard, false);
    expect(result.hasChanges).toBe(false);
    expect(result.diffCount).toBe(0);
  });

  it('Can detect time changed', () => {
    const dashboard = setup();

    sceneGraph.getTimeRange(dashboard).setState({ from: 'now-1h', to: 'now' });

    const result = getSaveDashboardChange(dashboard, false);
    expect(result.hasChanges).toBe(false);
    expect(result.diffCount).toBe(0);
    expect(result.hasTimeChanges).toBe(true);
  });

  it('Can save time change', () => {
    const dashboard = setup();

    sceneGraph.getTimeRange(dashboard).setState({ from: 'now-1h', to: 'now' });

    const result = getSaveDashboardChange(dashboard, true);
    expect(result.hasChanges).toBe(true);
    expect(result.diffCount).toBe(1);
  });

  it('Can detect variable change', () => {
    const dashboard = setup();

    const appVar = sceneGraph.lookupVariable('app', dashboard) as MultiValueVariable;
    appVar.changeValueTo('app2');

    const result = getSaveDashboardChange(dashboard, false, false);

    expect(result.hasVariableValueChanges).toBe(true);
    expect(result.hasChanges).toBe(false);
    expect(result.diffCount).toBe(0);
  });

  it('Can save variable value change', () => {
    const dashboard = setup();

    const appVar = sceneGraph.lookupVariable('app', dashboard) as MultiValueVariable;
    appVar.changeValueTo('app2');

    const result = getSaveDashboardChange(dashboard, false, true);

    expect(result.hasVariableValueChanges).toBe(true);
    expect(result.hasChanges).toBe(true);
    expect(result.diffCount).toBe(2);
  });
});

function setup() {
  const dashboard = transformSaveModelToScene({
    dashboard: {
      title: 'hello',
      uid: 'my-uid',
      schemaVersion: 30,
      panels: [],
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
