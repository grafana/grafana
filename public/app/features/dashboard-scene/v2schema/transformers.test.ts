import { config } from '@grafana/runtime';
import { CustomVariable, GroupByVariable } from '@grafana/scenes';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { handyTestingSchema } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/examples';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';

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

describe('V2 Transformers', () => {
  beforeAll(() => {
    config.featureToggles.groupByVariable = true;
  });

  afterAll(() => {
    config.featureToggles.groupByVariable = false;
  });
  it('should match original V2 Schema when transforming to scene and back to V2 Schema', async () => {
    const dashV2Scene = transformSaveModelSchemaV2ToScene(defaultDashboard);
    // Find and manually set options for CustomVariable
    // Options are set based on query field using getValueOptions
    const customVariable = dashV2Scene.state.$variables?.state.variables.find(
      (v) => v instanceof CustomVariable
    ) as CustomVariable;
    expect(customVariable).toBeDefined();

    const customOptions$ = customVariable.getValueOptions({});
    const customOptions = await customOptions$.toPromise();
    customVariable.setState({ options: customOptions });

    // Find and manually set defaultOptions for GroupByVariable
    // If defaultOptions are provided, getValueOptions will set options to defaultOptions
    const groupByVariable = dashV2Scene.state.$variables?.state.variables.find(
      (v) => v instanceof GroupByVariable
    ) as GroupByVariable;
    expect(groupByVariable).toBeDefined();

    // Set default options directly in state
    groupByVariable.setState({
      defaultOptions: [
        { text: 'option1', value: 'option1' },
        { text: 'option2', value: 'option2' },
      ],
    });

    const groupOptions$ = groupByVariable.getValueOptions({});
    const groupOptions = await groupOptions$.toPromise();
    groupByVariable.setState({ options: groupOptions });

    // Transform back to dashboard V2 spec
    const dashV2 = transformSceneToSaveModelSchemaV2(dashV2Scene);

    expect(dashV2).toEqual(defaultDashboard.spec);
  });
});
