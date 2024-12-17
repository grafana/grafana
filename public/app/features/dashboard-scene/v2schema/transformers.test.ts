import fs from 'fs';
import path from 'path';

import { config } from '@grafana/runtime';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { handyTestingSchema } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/examples';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/dashboard_api';

import { transformSaveModelSchemaV2ToScene } from '../serialization/transformSaveModelSchemaV2ToScene';
import { transformSceneToSaveModelSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';

const defaultDashboard: DashboardWithAccessInfo<DashboardV2Spec> = {
  kind: 'DashboardWithAccessInfo',
  metadata: {
    name: 'dashboard-uid',
    namespace: 'default',
    labels: {},
    resourceVersion: '',
    creationTimestamp: '',
  },
  spec: handyTestingSchema,
  access: {},
  apiVersion: 'v2',
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: jest.fn(),
  }),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    bootData: {
      settings: {
        defaultDatasource: 'prometheus',
        datasources: {
          prometheus: {
            name: 'datasource1',
            meta: { id: 'prometheus' },
            type: 'prometheus',
          },
        },
      },
    },
  },
}));

describe('transformers', () => {
  beforeAll(() => {
    config.featureToggles.groupByVariable = true;
  });

  afterAll(() => {
    config.featureToggles.groupByVariable = false;
  });
  it('v2->scene->v2', () => {
    const dashV2Scene = transformSaveModelSchemaV2ToScene(defaultDashboard);
    const dashV2 = transformSceneToSaveModelSchemaV2(dashV2Scene);

    // fs.writeFileSync(
    //   path.resolve(__dirname, 'dashv2scene.json'),
    //   JSON.stringify(dashV2Scene.state.$data?.state, null, 2)
    // );
    // save dashV2 to file and compare with handyTestingSchema
    fs.writeFileSync(path.resolve(__dirname, 'dashv2.json'), JSON.stringify(dashV2, null, 2));

    expect(dashV2).toEqual(defaultDashboard.spec);
  });
});
