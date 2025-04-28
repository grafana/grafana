import { thunkTester } from 'test/core/thunk/thunkTester';

import { DataSourceInstanceSettings, ThresholdsMode } from '@grafana/data';
import { defaultDashboard, FieldColorModeId } from '@grafana/schema';
import {
  DashboardV2Spec,
  defaultDashboardV2Spec,
  defaultPanelSpec,
  defaultQueryVariableSpec,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { browseDashboardsAPI } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { getLibraryPanel } from 'app/features/library-panels/state/api';

import { PanelModel } from '../../dashboard/state/PanelModel';
import { LibraryElementDTO } from '../../library-panels/types';
import { DashboardJson } from '../types';
import { validateDashboardJson } from '../utils/validation';

import { getLibraryPanelInputs, importDashboard, processDashboard, processV2Datasources } from './actions';
import { DataSourceInput, ImportDashboardDTO, initialImportDashboardState, InputType } from './reducers';

jest.mock('app/features/library-panels/state/api');
const mocks = {
  getLibraryPanel: jest.mocked(getLibraryPanel),
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    ...jest.requireActual('@grafana/runtime').getDataSourceSrv(),
    get: jest.fn().mockImplementation((dsType: { type: string }) => {
      const dsList: {
        [key: string]: {
          uid: string;
          name: string;
          type: string;
          meta: { id: string };
        };
      } = {
        prometheus: {
          uid: 'prom-uid',
          name: 'prometheus',
          type: 'prometheus',
          meta: { id: 'prometheus' },
        },
        loki: {
          uid: 'loki-uid',
          name: 'Loki',
          type: 'loki',
          meta: { id: 'loki' },
        },
        grafana: {
          uid: 'grafana-uid',
          name: 'Grafana',
          type: 'grafana',
          meta: { id: 'grafana' },
        },
      };
      return dsList[dsType.type];
    }),
  }),
}));

describe('importDashboard', () => {
  it('Should send data source uid', async () => {
    // note: the actual action returned is more complicated
    // but we don't really care about the return type in this test
    // we're only testing that the correct data is passed to initiate
    const mockAction = jest.fn().mockImplementation(() => ({
      type: 'foo',
    }));
    const importDashboardRtkQueryMock = jest
      .spyOn(browseDashboardsAPI.endpoints.importDashboard, 'initiate')
      .mockImplementation(mockAction);
    const form: ImportDashboardDTO = {
      title: 'Asda',
      uid: '12',
      gnetId: 'asd',
      constants: [],
      dataSources: [
        {
          id: 1,
          uid: 'ds-uid',
          name: 'ds-name',
          type: 'prometheus',
        } as DataSourceInstanceSettings,
      ],
      elements: [],
      folder: {
        uid: '5v6e5VH4z',
        title: 'title',
      },
    };

    await thunkTester({
      importDashboard: {
        ...initialImportDashboardState,
        inputs: {
          dataSources: [
            {
              name: 'ds-name',
              pluginId: 'prometheus',
              type: InputType.DataSource,
            },
          ] as DataSourceInput[],
          constants: [],
          libraryPanels: [],
        },
      },
    })
      .givenThunk(importDashboard)
      .whenThunkIsDispatched(form);

    expect(importDashboardRtkQueryMock).toHaveBeenCalledWith({
      dashboard: {
        title: 'Asda',
        uid: '12',
      },
      folderUid: '5v6e5VH4z',
      inputs: [
        {
          name: 'ds-name',
          pluginId: 'prometheus',
          type: 'datasource',
          value: 'ds-uid',
        },
      ],
      overwrite: true,
    });
  });
});

describe('validateDashboardJson', () => {
  it('Should return true if correct json', async () => {
    const jsonImportCorrectFormat = '{"title": "Correct Format", "tags": ["tag1", "tag2"], "schemaVersion": 36}';
    const validateDashboardJsonCorrectFormat = await validateDashboardJson(jsonImportCorrectFormat);
    expect(validateDashboardJsonCorrectFormat).toBe(true);
  });
  it('Should not return true if nested tags', async () => {
    const jsonImportNestedTags =
      '{"title": "Nested tags","tags": ["tag1", "tag2", ["nestedTag1", "nestedTag2"]],"schemaVersion": 36}';
    const validateDashboardJsonNestedTags = await validateDashboardJson(jsonImportNestedTags);
    expect(validateDashboardJsonNestedTags).toBe('tags expected array of strings');
  });
  it('Should not return true if not an array', async () => {
    const jsonImportNotArray = '{"title": "Not Array","tags": "tag1","schemaVersion":36}';
    const validateDashboardJsonNotArray = await validateDashboardJson(jsonImportNotArray);
    expect(validateDashboardJsonNotArray).toBe('tags expected array');
  });
  it('Should not return true if not an array and is blank string', async () => {
    const jsonImportEmptyTags = '{"schemaVersion": 36,"tags": "", "title": "Empty Tags"}';
    const validateDashboardJsonEmptyTags = await validateDashboardJson(jsonImportEmptyTags);
    expect(validateDashboardJsonEmptyTags).toBe('tags expected array');
  });
  it('Should not return true if not valid JSON', async () => {
    const jsonImportInvalidJson = '{"schemaVersion": 36,"tags": {"tag", "nested tag"}, "title": "Nested lists"}';
    const validateDashboardJsonNotValid = await validateDashboardJson(jsonImportInvalidJson);
    expect(validateDashboardJsonNotValid).toBe('Not valid JSON');
  });
});

describe('processDashboard', () => {
  const panel = new PanelModel({
    datasource: {
      type: 'mysql',
      uid: '${DS_GDEV-MYSQL}',
    },
  });

  const panelWithLibPanel = {
    gridPos: {
      h: 8,
      w: 12,
      x: 0,
      y: 8,
    },
    id: 3,
    libraryPanel: {
      uid: 'a0379b21-fa20-4313-bf12-d7fd7ceb6f90',
      name: 'another prom lib panel',
    },
  };
  const libPanel = {
    'a0379b21-fa20-4313-bf12-d7fd7ceb6f90': {
      name: 'another prom lib panel',
      uid: 'a0379b21-fa20-4313-bf12-d7fd7ceb6f90',
      kind: 1,
      model: {
        datasource: {
          type: 'prometheus',
          uid: '${DS_GDEV-PROMETHEUS-FOR-LIBRARY-PANEL}',
        },
        description: '',
        fieldConfig: {
          defaults: {
            color: {
              mode: 'palette-classic',
            },
            custom: {
              axisCenteredZero: false,
              axisColorMode: 'text',
              axisLabel: '',
              axisPlacement: 'auto',
              barAlignment: 0,
              drawStyle: 'line',
              fillOpacity: 0,
              gradientMode: 'none',
              hideFrom: {
                legend: false,
                tooltip: false,
                viz: false,
              },
              lineInterpolation: 'linear',
              lineWidth: 1,
              pointSize: 5,
              scaleDistribution: {
                type: 'linear',
              },
              showPoints: 'auto',
              spanNulls: false,
              stacking: {
                group: 'A',
                mode: 'none',
              },
              thresholdsStyle: {
                mode: 'off',
              },
            },
            mappings: [],
            thresholds: {
              mode: 'absolute',
              steps: [
                {
                  color: 'green',
                  value: null,
                },
                {
                  color: 'red',
                  value: 80,
                },
              ],
            },
          },
          overrides: [],
        },
        libraryPanel: {
          name: 'another prom lib panel',
          uid: 'a0379b21-fa20-4313-bf12-d7fd7ceb6f90',
        },
        options: {
          legend: {
            calcs: [],
            displayMode: 'list',
            placement: 'bottom',
            showLegend: true,
          },
          tooltip: {
            mode: 'single',
            sort: 'none',
          },
        },
        targets: [
          {
            datasource: {
              type: 'prometheus',
              uid: 'gdev-prometheus',
            },
            editorMode: 'builder',
            expr: 'access_evaluation_duration_bucket',
            instant: false,
            range: true,
            refId: 'A',
          },
        ],
        title: 'Panel Title',
        type: 'timeseries',
      },
    },
  };

  const panelWithSecondLibPanel = {
    gridPos: {
      h: 8,
      w: 12,
      x: 0,
      y: 16,
    },
    id: 1,
    libraryPanel: {
      uid: 'c46a6b49-de40-43b3-982c-1b5e1ec084a4',
      name: 'Testing lib panel',
    },
  };
  const secondLibPanel = {
    'c46a6b49-de40-43b3-982c-1b5e1ec084a4': {
      name: 'Testing lib panel',
      uid: 'c46a6b49-de40-43b3-982c-1b5e1ec084a4',
      kind: 1,
      model: {
        datasource: {
          type: 'prometheus',
          uid: '${DS_GDEV-PROMETHEUS-FOR-LIBRARY-PANEL}',
        },
        description: '',
        fieldConfig: {
          defaults: {
            color: {
              mode: 'palette-classic',
            },
            custom: {
              axisCenteredZero: false,
              axisColorMode: 'text',
              axisLabel: '',
              axisPlacement: 'auto',
              barAlignment: 0,
              drawStyle: 'line',
              fillOpacity: 0,
              gradientMode: 'none',
              hideFrom: {
                legend: false,
                tooltip: false,
                viz: false,
              },
              lineInterpolation: 'linear',
              lineWidth: 1,
              pointSize: 5,
              scaleDistribution: {
                type: 'linear',
              },
              showPoints: 'auto',
              spanNulls: false,
              stacking: {
                group: 'A',
                mode: 'none',
              },
              thresholdsStyle: {
                mode: 'off',
              },
            },
            mappings: [],
            thresholds: {
              mode: 'absolute',
              steps: [
                {
                  color: 'green',
                  value: null,
                },
                {
                  color: 'red',
                  value: 80,
                },
              ],
            },
          },
          overrides: [],
        },
        libraryPanel: {
          name: 'Testing lib panel',
          uid: 'c46a6b49-de40-43b3-982c-1b5e1ec084a4',
        },
        options: {
          legend: {
            calcs: [],
            displayMode: 'list',
            placement: 'bottom',
            showLegend: true,
          },
          tooltip: {
            mode: 'single',
            sort: 'none',
          },
        },
        targets: [
          {
            datasource: {
              type: 'prometheus',
              uid: 'gdev-prometheus',
            },
            editorMode: 'builder',
            expr: 'access_evaluation_duration_count',
            instant: false,
            range: true,
            refId: 'A',
          },
        ],
        title: 'Panel Title',
        type: 'timeseries',
      },
    },
  };

  const importedJson: DashboardJson = {
    ...defaultDashboard,
    __inputs: [
      {
        name: 'DS_GDEV-MYSQL',
        label: 'gdev-mysql',
        description: '',
        type: 'datasource',
        value: '',
      },
      {
        name: 'DS_GDEV-PROMETHEUS-FOR-LIBRARY-PANEL',
        label: 'gdev-prometheus',
        description: '',
        type: 'datasource',
        value: '',
        usage: {
          libraryPanels: [
            {
              name: 'another prom lib panel',
              uid: 'a0379b21-fa20-4313-bf12-d7fd7ceb6f90',
            },
          ],
        },
      },
    ],
    __elements: {
      ...libPanel,
    },
    __requires: [
      {
        type: 'grafana',
        id: 'grafana',
        name: 'Grafana',
        version: '10.1.0-pre',
      },
      {
        type: 'datasource',
        id: 'mysql',
        name: 'MySQL',
        version: '1.0.0',
      },
      {
        type: 'datasource',
        id: 'prometheus',
        name: 'Prometheus',
        version: '1.0.0',
      },
      {
        type: 'panel',
        id: 'table',
        name: 'Table',
        version: '',
      },
    ],
    panels: [],
  };

  it("Should return 2 inputs, 1 for library panel because it's used for 2 panels", async () => {
    mocks.getLibraryPanel.mockImplementation(() => {
      throw { status: 404 };
    });
    const importDashboardState = initialImportDashboardState;
    const dashboardJson: DashboardJson = {
      ...importedJson,
      panels: [panel, panelWithLibPanel, panelWithLibPanel],
    };
    const libPanelInputs = await getLibraryPanelInputs(dashboardJson);
    const newDashboardState = {
      ...importDashboardState,
      inputs: {
        ...importDashboardState.inputs,
        libraryPanels: libPanelInputs!,
      },
    };

    const processedDashboard = processDashboard(dashboardJson, newDashboardState);
    const dsInputsForLibPanels = processedDashboard.__inputs!.filter((input) => !!input.usage?.libraryPanels);
    expect(processedDashboard.__inputs).toHaveLength(2);
    expect(dsInputsForLibPanels).toHaveLength(1);
  });
  it('Should return 3 inputs, 2 for library panels', async () => {
    mocks.getLibraryPanel.mockImplementation(() => {
      throw { status: 404 };
    });
    const importDashboardState = initialImportDashboardState;
    const dashboardJson: DashboardJson = {
      ...importedJson,
      __inputs: [
        {
          name: 'DS_GDEV-MYSQL',
          label: 'gdev-mysql',
          description: '',
          type: 'datasource',
          value: '',
        },
        {
          name: 'DS_GDEV-PROMETHEUS-FOR-LIBRARY-PANEL',
          label: 'gdev-prometheus',
          description: '',
          type: 'datasource',
          value: '',
          usage: {
            libraryPanels: [
              {
                name: 'another prom lib panel',
                uid: 'a0379b21-fa20-4313-bf12-d7fd7ceb6f90',
              },
            ],
          },
        },
        {
          name: 'DS_GDEV-MYSQL-FOR-LIBRARY-PANEL',
          label: 'gdev-mysql-2',
          description: '',
          type: 'datasource',
          value: '',
          usage: {
            libraryPanels: [
              {
                uid: 'c46a6b49-de40-43b3-982c-1b5e1ec084a4',
                name: 'Testing lib panel',
              },
            ],
          },
        },
      ],
      __elements: {
        ...libPanel,
        ...secondLibPanel,
      },
      panels: [panel, panelWithLibPanel, panelWithSecondLibPanel],
    };
    const libPanelInputs = await getLibraryPanelInputs(dashboardJson);
    const newDashboardState = {
      ...importDashboardState,
      inputs: {
        ...importDashboardState.inputs,
        libraryPanels: libPanelInputs!,
      },
    };

    const processedDashboard = processDashboard(dashboardJson, newDashboardState);
    const dsInputsForLibPanels = processedDashboard.__inputs!.filter((input) => !!input.usage?.libraryPanels);
    expect(processedDashboard.__inputs).toHaveLength(3);
    expect(dsInputsForLibPanels).toHaveLength(2);
  });

  it('Should return 1 input, since library panels already exist in the instance', async () => {
    const getLibPanelFirstRS: LibraryElementDTO = {
      folderUid: '',
      uid: 'a0379b21-fa20-4313-bf12-d7fd7ceb6f90',
      name: 'another prom lib panel',
      type: 'timeseries',
      description: '',
      model: {
        transparent: false,
        transformations: [],
        datasource: {
          type: 'prometheus',
          uid: 'gdev-prometheus',
        },
        description: '',
        fieldConfig: {
          defaults: {
            color: {
              mode: FieldColorModeId.PaletteClassic,
            },
            custom: {
              axisCenteredZero: false,
              axisColorMode: 'text',
              axisLabel: '',
              axisPlacement: 'auto',
              barAlignment: 0,
              drawStyle: 'line',
              fillOpacity: 0,
              gradientMode: 'none',
              hideFrom: {
                legend: false,
                tooltip: false,
                viz: false,
              },
              lineInterpolation: 'linear',
              lineWidth: 1,
              pointSize: 5,
              scaleDistribution: {
                type: 'linear',
              },
              showPoints: 'auto',
              spanNulls: false,
              stacking: {
                group: 'A',
                mode: 'none',
              },
              thresholdsStyle: {
                mode: 'off',
              },
            },
            mappings: [],
            thresholds: {
              mode: ThresholdsMode.Absolute,
              steps: [
                {
                  color: 'green',
                  value: null,
                },
                {
                  color: 'red',
                  value: 80,
                },
              ],
            },
          },
          overrides: [],
        },
        options: {
          legend: {
            calcs: [],
            displayMode: 'list',
            placement: 'bottom',
            showLegend: true,
          },
          tooltip: {
            mode: 'single',
            sort: 'none',
          },
        },
        targets: [
          {
            datasource: {
              type: 'prometheus',
              uid: 'gdev-prometheus',
            },
            editorMode: 'builder',
            expr: 'access_evaluation_duration_bucket',
            instant: false,
            range: true,
            refId: 'A',
          },
        ],
        title: 'Panel Title',
        type: 'timeseries',
      },
      version: 1,
    };

    const getLibPanelSecondRS: LibraryElementDTO = {
      folderUid: '',
      uid: 'c46a6b49-de40-43b3-982c-1b5e1ec084a4',
      name: 'Testing lib panel',
      type: 'timeseries',
      description: '',
      model: {
        transparent: false,
        transformations: [],
        datasource: {
          type: 'prometheus',
          uid: 'gdev-prometheus',
        },
        description: '',
        fieldConfig: {
          defaults: {
            color: {
              mode: FieldColorModeId.PaletteClassic,
            },
            custom: {
              axisCenteredZero: false,
              axisColorMode: 'text',
              axisLabel: '',
              axisPlacement: 'auto',
              barAlignment: 0,
              drawStyle: 'line',
              fillOpacity: 0,
              gradientMode: 'none',
              hideFrom: {
                legend: false,
                tooltip: false,
                viz: false,
              },
              lineInterpolation: 'linear',
              lineWidth: 1,
              pointSize: 5,
              scaleDistribution: {
                type: 'linear',
              },
              showPoints: 'auto',
              spanNulls: false,
              stacking: {
                group: 'A',
                mode: 'none',
              },
              thresholdsStyle: {
                mode: 'off',
              },
            },
            mappings: [],
            thresholds: {
              mode: ThresholdsMode.Absolute,
              steps: [
                {
                  color: 'green',
                  value: null,
                },
                {
                  color: 'red',
                  value: 80,
                },
              ],
            },
          },
          overrides: [],
        },
        options: {
          legend: {
            calcs: [],
            displayMode: 'list',
            placement: 'bottom',
            showLegend: true,
          },
          tooltip: {
            mode: 'single',
            sort: 'none',
          },
        },
        targets: [
          {
            datasource: {
              type: 'prometheus',
              uid: 'gdev-prometheus',
            },
            editorMode: 'builder',
            expr: 'access_evaluation_duration_count',
            instant: false,
            range: true,
            refId: 'A',
          },
        ],
        title: 'Panel Title',
        type: 'timeseries',
      },
      version: 1,
    };
    mocks.getLibraryPanel
      .mockReturnValueOnce(Promise.resolve(getLibPanelFirstRS))
      .mockReturnValueOnce(Promise.resolve(getLibPanelSecondRS));

    const importDashboardState = initialImportDashboardState;
    const dashboardJson: DashboardJson = {
      ...importedJson,
      __inputs: [
        {
          name: 'DS_GDEV-MYSQL',
          label: 'gdev-mysql',
          description: '',
          type: 'datasource',
          value: '',
        },
        {
          name: 'DS_GDEV-PROMETHEUS-FOR-LIBRARY-PANEL',
          label: 'gdev-prometheus',
          description: '',
          type: 'datasource',
          value: '',
          usage: {
            libraryPanels: [
              {
                name: 'another prom lib panel',
                uid: 'a0379b21-fa20-4313-bf12-d7fd7ceb6f90',
              },
            ],
          },
        },
        {
          name: 'DS_GDEV-MYSQL-FOR-LIBRARY-PANEL',
          label: 'gdev-mysql-2',
          description: '',
          type: 'datasource',
          value: '',
          usage: {
            libraryPanels: [
              {
                uid: 'c46a6b49-de40-43b3-982c-1b5e1ec084a4',
                name: 'Testing lib panel',
              },
            ],
          },
        },
      ],
      __elements: {
        ...libPanel,
        ...secondLibPanel,
      },
      panels: [panel, panelWithLibPanel, panelWithSecondLibPanel],
    };
    const libPanelInputs = await getLibraryPanelInputs(dashboardJson);
    const newDashboardState = {
      ...importDashboardState,
      inputs: {
        ...importDashboardState.inputs,
        libraryPanels: libPanelInputs!,
      },
    };

    const processedDashboard = processDashboard(dashboardJson, newDashboardState);
    const dsInputsForLibPanels = processedDashboard.__inputs!.filter((input) => !!input.usage?.libraryPanels);
    expect(processedDashboard.__inputs).toHaveLength(1);
    expect(dsInputsForLibPanels).toHaveLength(0);
  });
});

describe('processV2Datasources', () => {
  let panels: DashboardV2Spec['elements'];
  let v2DashboardJson: DashboardV2Spec;

  beforeEach(() => {
    panels = {
      'element-panel-a': {
        kind: 'Panel',
        spec: {
          ...defaultPanelSpec(),
          id: 1,
          title: 'Panel A',
          data: {
            kind: 'QueryGroup',
            spec: {
              transformations: [],
              queryOptions: {},
              queries: [
                {
                  kind: 'PanelQuery',
                  spec: {
                    refId: 'A',
                    hidden: false,
                    query: {
                      kind: 'prometheus',
                      spec: {
                        expr: 'access_evaluation_duration_count',
                        range: true,
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    };
    v2DashboardJson = {
      ...defaultDashboardV2Spec(),
      elements: {
        ...panels,
      },
      variables: [
        {
          kind: 'QueryVariable',
          spec: {
            ...defaultQueryVariableSpec(),
            name: 'var1',
            query: {
              kind: 'loki',
              spec: {
                expr: 'access_evaluation_duration_count',
                range: true,
              },
            },
          },
        },
      ],
      annotations: [
        {
          kind: 'AnnotationQuery',
          spec: {
            name: 'annotation1',
            enable: true,
            hide: false,
            iconColor: 'red',
            query: {
              kind: 'loki',
              spec: {
                expr: 'access_evaluation_duration_count',
                range: true,
              },
            },
          },
        },
      ],
      layout: {
        kind: 'GridLayout',
        spec: {
          items: [
            {
              kind: 'GridLayoutItem',
              spec: {
                x: 0,
                y: 0,
                width: 12,
                height: 8,
                element: {
                  kind: 'ElementReference',
                  name: 'element-panel-a',
                },
              },
            },
            {
              kind: 'GridLayoutItem',
              spec: {
                x: 0,
                y: 0,
                width: 12,
                height: 8,
                element: {
                  kind: 'ElementReference',
                  name: 'element-panel-b',
                },
              },
            },
          ],
        },
      },
    };
  });
  // should set the correct inputs for panels
  it('Should extract datasource inputs from panel queries, variables and annotations', async () => {
    // Execute the test using thunkTester
    const dispatchedActions = await thunkTester({
      thunk: processV2Datasources,
      initialState: {
        inputs: [
          // for panels
          {
            name: 'Prometheus',
            pluginId: 'prometheus',
            type: InputType.DataSource,
          },
          // for variables and annotations
          {
            name: 'Loki',
            pluginId: 'loki',
            type: InputType.DataSource,
          },
        ],
      },
    })
      .givenThunk(processV2Datasources)
      .whenThunkIsDispatched(v2DashboardJson);

    // Find the setInputs action in the dispatched actions
    const setInputsAction = dispatchedActions.find((action) => action.type === 'manageDashboards/setInputs');
    //
    // Verify the action was dispatched
    expect(setInputsAction).toBeDefined();

    // Verify the datasource inputs were correctly extracted
    expect(setInputsAction?.payload).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'prometheus',
          pluginId: 'prometheus',
          type: InputType.DataSource,
        }),
        expect.objectContaining({
          name: 'Loki',
          pluginId: 'loki',
          type: InputType.DataSource,
        }),
      ])
    );
  });
});
