// import { map, of } from 'rxjs';

// import { DataQueryRequest, DataSourceApi, DataSourceInstanceSettings, LoadingState, PanelData } from '@grafana/data';
// import { calculateFieldTransformer } from '@grafana/data/src/transformations/transformers/calculateField';
// import { mockTransformationsRegistry } from '@grafana/data/src/utils/tests/mockTransformationsRegistry';
// import { config, locationService } from '@grafana/runtime';
// import {
//   CustomVariable,
//   LocalValueVariable,
//   SceneGridRow,
//   SceneVariableSet,
//   VizPanel,
//   sceneGraph,
// } from '@grafana/scenes';
// import { DataQuery, DataSourceJsonData, DataSourceRef } from '@grafana/schema';
// import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
// import { InspectTab } from 'app/features/inspector/types';
// import * as libAPI from 'app/features/library-panels/state/api';
// import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard';
// import { DASHBOARD_DATASOURCE_PLUGIN_ID } from 'app/plugins/datasource/dashboard/types';

// import { DashboardGridItem } from '../scene/DashboardGridItem';
// import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';
// import { PanelTimeRange, PanelTimeRangeState } from '../scene/PanelTimeRange';
// import { transformSaveModelToScene } from '../serialization/transformSaveModelToScene';
// import { vizPanelToPanel } from '../serialization/transformSceneToSaveModel';
// import { DashboardModelCompatibilityWrapper } from '../utils/DashboardModelCompatibilityWrapper';
// import { findVizPanelByKey } from '../utils/utils';

// import { buildPanelEditScene } from './PanelEditor';
// import { VizPanelManager } from './VizPanelManager';
// import { panelWithQueriesOnly, panelWithTransformations, testDashboard } from './testfiles/testDashboard';

// const runRequestMock = jest.fn().mockImplementation((ds: DataSourceApi, request: DataQueryRequest) => {
//   const result: PanelData = {
//     state: LoadingState.Loading,
//     series: [],
//     timeRange: request.range,
//   };

//   return of([]).pipe(
//     map(() => {
//       result.state = LoadingState.Done;
//       result.series = [];

//       return result;
//     })
//   );
// });

// const ds1Mock: DataSourceApi = {
//   meta: {
//     id: 'grafana-testdata-datasource',
//   },
//   name: 'grafana-testdata-datasource',
//   type: 'grafana-testdata-datasource',
//   uid: 'gdev-testdata',
//   getRef: () => {
//     return { type: 'grafana-testdata-datasource', uid: 'gdev-testdata' };
//   },
// } as DataSourceApi<DataQuery, DataSourceJsonData, {}>;

// const ds2Mock: DataSourceApi = {
//   meta: {
//     id: 'grafana-prometheus-datasource',
//   },
//   name: 'grafana-prometheus-datasource',
//   type: 'grafana-prometheus-datasource',
//   uid: 'gdev-prometheus',
//   getRef: () => {
//     return { type: 'grafana-prometheus-datasource', uid: 'gdev-prometheus' };
//   },
// } as DataSourceApi<DataQuery, DataSourceJsonData, {}>;

// const ds3Mock: DataSourceApi = {
//   meta: {
//     id: DASHBOARD_DATASOURCE_PLUGIN_ID,
//   },
//   name: SHARED_DASHBOARD_QUERY,
//   type: SHARED_DASHBOARD_QUERY,
//   uid: SHARED_DASHBOARD_QUERY,
//   getRef: () => {
//     return { type: SHARED_DASHBOARD_QUERY, uid: SHARED_DASHBOARD_QUERY };
//   },
// } as DataSourceApi<DataQuery, DataSourceJsonData, {}>;

// const defaultDsMock: DataSourceApi = {
//   meta: {
//     id: 'grafana-testdata-datasource',
//   },
//   name: 'grafana-testdata-datasource',
//   type: 'grafana-testdata-datasource',
//   uid: 'gdev-testdata',
//   getRef: () => {
//     return { type: 'grafana-testdata-datasource', uid: 'gdev-testdata' };
//   },
// } as DataSourceApi<DataQuery, DataSourceJsonData, {}>;

// const instance1SettingsMock = {
//   id: 1,
//   uid: 'gdev-testdata',
//   name: 'testDs1',
//   type: 'grafana-testdata-datasource',
//   meta: {
//     id: 'grafana-testdata-datasource',
//   },
// };

// const instance2SettingsMock = {
//   id: 1,
//   uid: 'gdev-prometheus',
//   name: 'testDs2',
//   type: 'grafana-prometheus-datasource',
//   meta: {
//     id: 'grafana-prometheus-datasource',
//   },
// };

// // Mocking the build in Grafana data source to avoid annotations data layer errors.
// const grafanaDs = {
//   id: 1,
//   uid: '-- Grafana --',
//   name: 'grafana',
//   type: 'grafana',
//   meta: {
//     id: 'grafana',
//   },
// };

// // Mock the store module
// jest.mock('app/core/store', () => ({
//   exists: jest.fn(),
//   get: jest.fn(),
//   getObject: jest.fn((_a, b) => b),
//   setObject: jest.fn(),
// }));

// const store = jest.requireMock('app/core/store');

// jest.mock('@grafana/runtime', () => ({
//   ...jest.requireActual('@grafana/runtime'),
//   getRunRequest: () => (ds: DataSourceApi, request: DataQueryRequest) => {
//     return runRequestMock(ds, request);
//   },
//   getDataSourceSrv: () => ({
//     get: async (ref: DataSourceRef) => {
//       // Mocking the build in Grafana data source to avoid annotations data layer errors.

//       if (ref.uid === '-- Grafana --') {
//         return grafanaDs;
//       }

//       if (ref.uid === 'gdev-testdata') {
//         return ds1Mock;
//       }

//       if (ref.uid === 'gdev-prometheus') {
//         return ds2Mock;
//       }

//       if (ref.uid === SHARED_DASHBOARD_QUERY) {
//         return ds3Mock;
//       }

//       // if datasource is not found, return default datasource
//       return defaultDsMock;
//     },
//     getInstanceSettings: (ref: DataSourceRef) => {
//       if (ref.uid === 'gdev-testdata') {
//         return instance1SettingsMock;
//       }

//       if (ref.uid === 'gdev-prometheus') {
//         return instance2SettingsMock;
//       }

//       // if datasource is not found, return default instance settings
//       return instance1SettingsMock;
//     },
//   }),
//   locationService: {
//     partial: jest.fn(),
//   },
//   config: {
//     ...jest.requireActual('@grafana/runtime').config,
//     defaultDatasource: 'gdev-testdata',
//   },
// }));

// mockTransformationsRegistry([calculateFieldTransformer]);

// jest.useFakeTimers();

// describe('VizPanelManager', () => {

//   describe('change transformations', () => {
//     it('should update and reprocess transformations', () => {
//       const { scene, panel } = setupTest('panel-3');
//       scene.setState({ editPanel: buildPanelEditScene(panel) });

//       const vizPanelManager = scene.state.editPanel!.state.vizManager;
//       vizPanelManager.activate();
//       vizPanelManager.state.panel.state.$data?.activate();

//       const reprocessMock = jest.fn();
//       vizPanelManager.dataTransformer.reprocessTransformations = reprocessMock;
//       vizPanelManager.changeTransformations([{ id: 'calculateField', options: {} }]);

//       jest.runAllTimers(); // The detect panel changes is debounced
//       expect(vizPanelManager.state.isDirty).toBe(true);
//       expect(reprocessMock).toHaveBeenCalledTimes(1);
//       expect(vizPanelManager.dataTransformer.state.transformations).toEqual([{ id: 'calculateField', options: {} }]);
//     });
//   });

//   describe('Given a panel inside repeated row', () => {
//     it('Should include row variable scope', () => {
//       const { panel } = setupTest('panel-9');

//       const row = panel.parent?.parent;
//       if (!(row instanceof SceneGridRow)) {
//         throw new Error('Did not find parent row');
//       }

//       row.setState({
//         $variables: new SceneVariableSet({ variables: [new LocalValueVariable({ name: 'hello', value: 'A' })] }),
//       });

//       const editor = buildPanelEditScene(panel);
//       const variable = sceneGraph.lookupVariable('hello', editor.state.vizManager);
//       expect(variable?.getValue()).toBe('A');
//     });
//   });
// });

// const setupTest = (panelId: string) => {
//   const scene = transformSaveModelToScene({ dashboard: testDashboard, meta: {} });

//   const panel = findVizPanelByKey(scene, panelId)!;

//   const vizPanelManager = VizPanelManager.createFor(panel);
//   // The following happens on DahsboardScene activation. For the needs of this test this activation aint needed hence we hand-call it
//   // @ts-expect-error
//   getDashboardSrv().setCurrent(new DashboardModelCompatibilityWrapper(scene));

//   return { vizPanelManager, scene, panel };
// };
