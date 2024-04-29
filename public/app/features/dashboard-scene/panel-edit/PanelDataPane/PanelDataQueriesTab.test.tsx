import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { of, map } from 'rxjs';

import {
  DataQuery,
  DataQueryRequest,
  DataSourceApi,
  DataSourceJsonData,
  DataSourceRef,
  DataTransformerConfig,
  FieldType,
  LoadingState,
  PanelData,
  TimeRange,
  standardTransformersRegistry,
  toDataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneDataTransformer, SceneQueryRunner } from '@grafana/scenes';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard';
import { DASHBOARD_DATASOURCE_PLUGIN_ID } from 'app/plugins/datasource/dashboard/types';
import { DashboardDataDTO } from 'app/types';

import { transformSaveModelToScene } from '../../serialization/transformSaveModelToScene';
import { DashboardModelCompatibilityWrapper } from '../../utils/DashboardModelCompatibilityWrapper';
import { findVizPanelByKey } from '../../utils/utils';
import { VizPanelManager } from '../VizPanelManager';
import { testDashboard } from '../testfiles/testDashboard';

import { PanelDataQueriesTab, PanelDataQueriesTabRendered } from './PanelDataQueriesTab';

function createModelMock(
  panelData: PanelData,
  transformations?: DataTransformerConfig[],
  onChangeTransformationsMock?: Function
) {
  return {
    getDataTransformer: () => new SceneDataTransformer({ data: panelData, transformations: transformations || [] }),
    getQueryRunner: () => new SceneQueryRunner({ queries: [], data: panelData }),
    onChangeTransformations: onChangeTransformationsMock,
  } as unknown as PanelDataQueriesTab;
}

const mockData = {
  timeRange: {} as unknown as TimeRange,
  state: {} as unknown as LoadingState,
  series: [
    toDataFrame({
      name: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [100, 200, 300] },
        { name: 'values', type: FieldType.number, values: [1, 2, 3] },
      ],
    }),
  ],
};
const runRequestMock = jest.fn().mockImplementation((ds: DataSourceApi, request: DataQueryRequest) => {
  const result: PanelData = {
    state: LoadingState.Loading,
    series: [],
    timeRange: request.range,
  };

  return of([]).pipe(
    map(() => {
      result.state = LoadingState.Done;
      result.series = [];

      return result;
    })
  );
});

const ds1Mock: DataSourceApi = {
  meta: {
    id: 'grafana-testdata-datasource',
  },
  name: 'grafana-testdata-datasource',
  type: 'grafana-testdata-datasource',
  uid: 'gdev-testdata',
  getRef: () => {
    return { type: 'grafana-testdata-datasource', uid: 'gdev-testdata' };
  },
} as DataSourceApi<DataQuery, DataSourceJsonData, {}>;

const ds2Mock: DataSourceApi = {
  meta: {
    id: 'grafana-prometheus-datasource',
  },
  name: 'grafana-prometheus-datasource',
  type: 'grafana-prometheus-datasource',
  uid: 'gdev-prometheus',
  getRef: () => {
    return { type: 'grafana-prometheus-datasource', uid: 'gdev-prometheus' };
  },
} as DataSourceApi<DataQuery, DataSourceJsonData, {}>;

const ds3Mock: DataSourceApi = {
  meta: {
    id: DASHBOARD_DATASOURCE_PLUGIN_ID,
  },
  name: SHARED_DASHBOARD_QUERY,
  type: SHARED_DASHBOARD_QUERY,
  uid: SHARED_DASHBOARD_QUERY,
  getRef: () => {
    return { type: SHARED_DASHBOARD_QUERY, uid: SHARED_DASHBOARD_QUERY };
  },
} as DataSourceApi<DataQuery, DataSourceJsonData, {}>;

const defaultDsMock: DataSourceApi = {
  meta: {
    id: 'grafana-testdata-datasource',
  },
  name: 'grafana-testdata-datasource',
  type: 'grafana-testdata-datasource',
  uid: 'gdev-testdata',
  getRef: () => {
    return { type: 'grafana-testdata-datasource', uid: 'gdev-testdata' };
  },
} as DataSourceApi<DataQuery, DataSourceJsonData, {}>;

const instance1SettingsMock = {
  id: 1,
  uid: 'gdev-testdata',
  name: 'testDs1',
  type: 'grafana-testdata-datasource',
  meta: {
    id: 'grafana-testdata-datasource',
  },
};

const instance2SettingsMock = {
  id: 1,
  uid: 'gdev-prometheus',
  name: 'testDs2',
  type: 'grafana-prometheus-datasource',
  meta: {
    id: 'grafana-prometheus-datasource',
  },
};

// Mocking the build in Grafana data source to avoid annotations data layer errors.
const grafanaDs = {
  id: 1,
  uid: '-- Grafana --',
  name: 'grafana',
  type: 'grafana',
  meta: {
    id: 'grafana',
  },
};

// Mocking the build in Grafana data source to avoid annotations data layer errors.
const MixedDs = {
  id: 5,
  uid: '-- Mixed --',
  name: 'Mixed',
  type: 'datasource',
  meta: {
    id: 'grafana',
  },
};

const MixedDsSettingsMock = {
  id: 5,
  uid: '-- Mixed --',
  name: 'Mixed',
  type: 'datasource',
  meta: {
    id: 'grafana',
  },
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getRunRequest: () => (ds: DataSourceApi, request: DataQueryRequest) => {
    return runRequestMock(ds, request);
  },
  getDataSourceSrv: () => ({
    get: async (ref: DataSourceRef) => {
      // Mocking the build in Grafana data source to avoid annotations data layer errors.
      if (ref.uid === '-- Grafana --') {
        return grafanaDs;
      }

      if (ref.uid === 'gdev-testdata') {
        return ds1Mock;
      }

      if (ref.uid === 'gdev-prometheus') {
        return ds2Mock;
      }

      if (ref.uid === '-- Mixed --') {
        return MixedDs;
      }

      if (ref.uid === SHARED_DASHBOARD_QUERY) {
        return ds3Mock;
      }

      // if datasource is not found, return default datasource
      return defaultDsMock;
    },
    getInstanceSettings: (ref: DataSourceRef) => {
      if (ref.uid === 'gdev-testdata') {
        return instance1SettingsMock;
      }

      if (ref.uid === 'gdev-prometheus') {
        return instance2SettingsMock;
      }

      if (ref.uid === '-- Mixed --') {
        return MixedDsSettingsMock;
      }

      // if datasource is not found, return default instance settings
      return instance1SettingsMock;
    },
  }),
  locationService: {
    partial: jest.fn(),
  },
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    defaultDatasource: 'gdev-testdata',
  },
}));
describe('PanelDataQueriesModel', () => {
  it('can add a new query', async () => {
    const vizPanelManager = setupVizPanelManger('panel-1');
    vizPanelManager.activate();
    await Promise.resolve();

    const model = new PanelDataQueriesTab(vizPanelManager);
    model.addQueryClick();
    expect(model.queryRunner.state.queries).toHaveLength(2);
    expect(model.queryRunner.state.queries[1].refId).toBe('B');
    expect(model.queryRunner.state.queries[1].hide).toBe(false);
    expect(model.queryRunner.state.queries[1].datasource).toEqual({
      type: 'grafana-testdata-datasource',
      uid: 'gdev-testdata',
    });
  });

  it('can add a new query when datasource is mixed', async () => {
    const vizPanelManager = setupVizPanelManger('panel-7');
    vizPanelManager.activate();
    await Promise.resolve();

    const model = new PanelDataQueriesTab(vizPanelManager);
    expect(vizPanelManager.state.datasource?.uid).toBe('-- Mixed --');
    model.addQueryClick();
    console.log('model state', vizPanelManager.state);
    expect(model.queryRunner.state.queries).toHaveLength(2);
    expect(model.queryRunner.state.queries[1].refId).toBe('B');
    expect(model.queryRunner.state.queries[1].hide).toBe(false);
    expect(model.queryRunner.state.queries[1].datasource).toEqual({
      type: 'grafana-testdata-datasource',
      uid: 'gdev-testdata',
    });
  });
});

// describe('PanelDataTransformationsTab', () => {
//   standardTransformersRegistry.setInit(getStandardTransformers);
//
//   it('renders empty message when there are no transformations', async () => {
//     const modelMock = createModelMock({} as PanelData);
//     render(<PanelDataQueriesTabRendered model={modelMock}></PanelDataQueriesTabRendered>);
//
//     await screen.findByTestId(selectors.components.Transforms.noTransformationsMessage);
//   });
//
//   it('renders transformations when there are transformations', async () => {
//     const modelMock = createModelMock(mockData, [
//       {
//         id: 'calculateField',
//         options: {},
//       },
//     ]);
//     render(<PanelDataQueriesTabRendered model={modelMock}></PanelDataQueriesTabRendered>);
//
//     await screen.findByText('1 - Add field from calculation');
//   });
//
//   it('shows show the transformation selection drawer', async () => {
//     const modelMock = createModelMock(mockData);
//     render(<PanelDataQueriesTabRendered model={modelMock}></PanelDataQueriesTabRendered>);
//     const addButton = await screen.findByTestId(selectors.components.Transforms.addTransformationButton);
//     await userEvent.click(addButton);
//     await screen.findByTestId(selectors.components.Transforms.searchInput);
//   });
//
//   it('adds a transformation when a transformation is clicked in the drawer and there are no previous transformations', async () => {
//     const onChangeTransformation = jest.fn();
//     const modelMock = createModelMock(mockData, [], onChangeTransformation);
//     render(<PanelDataQueriesTabRendered model={modelMock}></PanelDataQueriesTabRendered>);
//     const addButton = await screen.findByTestId(selectors.components.Transforms.addTransformationButton);
//     await userEvent.click(addButton);
//     const transformationCard = await screen.findByTestId(
//       selectors.components.TransformTab.newTransform('Add field from calculation')
//     );
//     const button = transformationCard.getElementsByTagName('button').item(0);
//     await userEvent.click(button!);
//
//     expect(onChangeTransformation).toHaveBeenCalledWith([{ id: 'calculateField', options: {} }]);
//   });
//
//   it('adds a transformation when a transformation is clicked in the drawer and there are transformations', async () => {
//     const onChangeTransformation = jest.fn();
//     const modelMock = createModelMock(
//       mockData,
//       [
//         {
//           id: 'calculateField',
//           options: {},
//         },
//       ],
//       onChangeTransformation
//     );
//     render(<PanelDataQueriesTabRendered model={modelMock}></PanelDataQueriesTabRendered>);
//     const addButton = await screen.findByTestId(selectors.components.Transforms.addTransformationButton);
//     await userEvent.click(addButton);
//     const transformationCard = await screen.findByTestId(
//       selectors.components.TransformTab.newTransform('Add field from calculation')
//     );
//     const button = transformationCard.getElementsByTagName('button').item(0);
//     await userEvent.click(button!);
//     expect(onChangeTransformation).toHaveBeenCalledWith([
//       { id: 'calculateField', options: {} },
//       { id: 'calculateField', options: {} },
//     ]);
//   });
//
//   it('deletes all transformations', async () => {
//     const onChangeTransformation = jest.fn();
//     const modelMock = createModelMock(
//       mockData,
//       [
//         {
//           id: 'calculateField',
//           options: {},
//         },
//       ],
//       onChangeTransformation
//     );
//     render(<PanelDataQueriesTabRendered model={modelMock}></PanelDataQueriesTabRendered>);
//     const removeButton = await screen.findByTestId(selectors.components.Transforms.removeAllTransformationsButton);
//     await userEvent.click(removeButton);
//     const confirmButton = await screen.findByTestId(selectors.pages.ConfirmModal.delete);
//     await userEvent.click(confirmButton);
//
//     expect(onChangeTransformation).toHaveBeenCalledWith([]);
//   });
//
//   it('can filter transformations in the drawer', async () => {
//     const modelMock = createModelMock(mockData);
//     render(<PanelDataQueriesTabRendered model={modelMock}></PanelDataQueriesTabRendered>);
//     const addButton = await screen.findByTestId(selectors.components.Transforms.addTransformationButton);
//     await userEvent.click(addButton);
//
//     const searchInput = await screen.findByTestId(selectors.components.Transforms.searchInput);
//
//     await screen.findByTestId(selectors.components.TransformTab.newTransform('Reduce'));
//
//     await userEvent.type(searchInput, 'add field');
//
//     await screen.findByTestId(selectors.components.TransformTab.newTransform('Add field from calculation'));
//     const reduce = screen.queryByTestId(selectors.components.TransformTab.newTransform('Reduce'));
//     expect(reduce).toBeNull();
//   });
// });
//
const setupVizPanelManger = (panelId: string) => {
  const scene = transformSaveModelToScene({ dashboard: testDashboard as unknown as DashboardDataDTO, meta: {} });
  const panel = findVizPanelByKey(scene, panelId)!;

  const vizPanelManager = VizPanelManager.createFor(panel);

  // The following happens on DahsboardScene activation. For the needs of this test this activation aint needed hence we hand-call it
  // @ts-expect-error
  getDashboardSrv().setCurrent(new DashboardModelCompatibilityWrapper(scene));

  return vizPanelManager;
};
