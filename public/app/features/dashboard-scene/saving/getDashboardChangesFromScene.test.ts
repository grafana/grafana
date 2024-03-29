import { config } from '@grafana/runtime';
import { AdHocFiltersVariable, GroupByVariable, MultiValueVariable, sceneGraph } from '@grafana/scenes';
import { VariableModel } from '@grafana/schema';

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

  it('Can detect folder change', () => {
    const dashboard = setup();

    dashboard.state.meta.folderUid = 'folder-2';

    const result = getDashboardChangesFromScene(dashboard, false);
    expect(result.hasChanges).toBe(true);
    expect(result.diffCount).toBe(0); // Diff count is 0 because the diff contemplate only the model
    expect(result.hasFolderChanges).toBe(true);
  });

  describe('variable changes', () => {
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

    describe('Experimental variables', () => {
      beforeAll(() => {
        config.featureToggles.groupByVariable = true;
      });

      afterAll(() => {
        config.featureToggles.groupByVariable = false;
      });

      it('Can detect group by static options change', () => {
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
                  type: 'groupby',
                  datasource: {
                    type: 'ds',
                    uid: 'ds-uid',
                  },
                  name: 'GroupBy',
                  options: [
                    {
                      text: 'Host',
                      value: 'host',
                    },
                    {
                      text: 'Region',
                      value: 'region',
                    },
                  ],
                },
              ],
            },
          },
          meta: {},
        });
        const initialSaveModel = transformSceneToSaveModel(dashboard);
        dashboard.setInitialSaveModel(initialSaveModel);

        const variable = sceneGraph.lookupVariable('GroupBy', dashboard) as GroupByVariable;
        variable.setState({ defaultOptions: [{ text: 'Host', value: 'host' }] });
        const result = getDashboardChangesFromScene(dashboard, false, false);

        expect(result.hasVariableValueChanges).toBe(false);
        expect(result.hasChanges).toBe(true);
        expect(result.diffCount).toBe(1);
      });

      it('Can detect adhoc filter static options change', () => {
        const adhocVar = {
          id: 'adhoc',
          name: 'adhoc',
          label: 'Adhoc Label',
          description: 'Adhoc Description',
          type: 'adhoc',
          datasource: {
            uid: 'gdev-prometheus',
            type: 'prometheus',
          },
          filters: [],
          baseFilters: [],
          defaultKeys: [
            {
              text: 'Host',
              value: 'host',
            },
            {
              text: 'Region',
              value: 'region',
            },
          ],
        } as VariableModel;

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
              list: [adhocVar],
            },
          },
          meta: {},
        });

        const initialSaveModel = transformSceneToSaveModel(dashboard);
        dashboard.setInitialSaveModel(initialSaveModel);

        const variable = sceneGraph.lookupVariable('adhoc', dashboard) as AdHocFiltersVariable;
        variable.setState({ defaultKeys: [{ text: 'Host', value: 'host' }] });
        const result = getDashboardChangesFromScene(dashboard, false, false);

        expect(result.hasVariableValueChanges).toBe(false);
        expect(result.hasChanges).toBe(true);
        expect(result.diffCount).toBe(1);
      });
    });
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
