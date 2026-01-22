import { DataSourceInstanceSettings } from '@grafana/data';
import {
  AnnotationQueryKind,
  PanelKind,
  QueryVariableKind,
  Spec as DashboardV2Spec,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { Dashboard, Panel, VariableModel } from '@grafana/schema/dist/esm/veneer/dashboard.types';

import { DashboardInputs, ImportDashboardDTO, InputType } from '../../types';

import { applyV1DatasourceInputs, applyV2DatasourceInputs } from './transform';

// Test helper types for accessing nested properties
interface PanelWithTargets extends Panel {
  targets?: Array<{ datasource?: { uid?: string } }>;
}

interface QueryVariableModel extends VariableModel {
  datasource?: { uid?: string };
}

interface DatasourceVariableModel extends VariableModel {
  current?: { value?: string; selected?: boolean };
}

const makeV1Inputs = (): DashboardInputs => ({
  dataSources: [
    {
      name: 'DS',
      label: 'DS',
      description: 'test',
      info: 'info',
      value: '',
      type: InputType.DataSource,
      pluginId: 'prometheus',
    },
  ],
  constants: [],
  libraryPanels: [],
});

describe('applyV1DatasourceInputs', () => {
  it('replaces templateized datasources across v1 dashboard', () => {
    const dashboard = {
      title: 'old',
      uid: 'old',
      annotations: {
        list: [
          {
            name: 'anno',
            datasource: { uid: '${DS}' },
            enable: true,
            iconColor: 'red',
            target: { limit: 1, matchAny: true, tags: [], type: 'tags' },
          },
        ],
      },
      panels: [
        {
          datasource: { uid: '${DS}' },
          targets: [{ datasource: { uid: '${DS}' } }],
        },
      ],
      templating: {
        list: [
          {
            type: 'query',
            datasource: { uid: '${DS}' },
          },
          {
            type: 'datasource',
            current: { value: '${DS}', selected: true },
          },
        ],
      },
    } as Dashboard;

    const form: ImportDashboardDTO = {
      title: 'new-title',
      uid: 'new-uid',
      gnetId: '',
      constants: [],
      dataSources: [{ uid: 'ds-uid', type: 'prometheus', name: 'My DS' } as DataSourceInstanceSettings],
      elements: [],
      folder: { uid: 'folder' },
    };

    const result = applyV1DatasourceInputs(dashboard, makeV1Inputs(), form);

    expect(result.title).toBe('new-title');
    expect(result.uid).toBe('new-uid');
    expect(result.annotations?.list?.[0].datasource?.uid).toBe('ds-uid');
    expect(result.panels?.[0].datasource?.uid).toBe('ds-uid');

    const panelWithTargets = result.panels?.[0] as PanelWithTargets;
    expect(panelWithTargets.targets?.[0].datasource?.uid).toBe('ds-uid');

    const queryVariable = result.templating?.list?.[0] as QueryVariableModel;
    expect(queryVariable.datasource?.uid).toBe('ds-uid');

    const dsVariable = result.templating?.list?.[1] as DatasourceVariableModel;
    expect(dsVariable.current?.value).toBe('ds-uid');
  });
});

describe('applyV2DatasourceInputs', () => {
  it('updates v2 annotations, variables, and panel queries', () => {
    const dashboard = {
      title: 'old',
      elements: {
        panel: {
          kind: 'Panel',
          spec: {
            data: {
              kind: 'QueryGroup',
              spec: {
                queries: [
                  {
                    kind: 'PanelQuery',
                    spec: {
                      query: { kind: 'prometheus' },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      annotations: [
        {
          kind: 'AnnotationQuery',
          spec: {
            query: {
              spec: { group: 'prometheus' },
            },
          },
        },
      ],
      variables: [
        {
          kind: 'QueryVariable',
          spec: {
            query: {
              spec: { group: 'prometheus' },
            },
          },
        },
      ],
    } as unknown as DashboardV2Spec;

    const result = applyV2DatasourceInputs(dashboard, {
      'datasource-prometheus': { uid: 'ds-uid', type: 'prometheus', name: 'My DS' },
    });

    const updatedAnnotation = result.annotations?.[0] as AnnotationQueryKind;
    expect(updatedAnnotation.spec.query?.datasource?.name).toBe('ds-uid');

    const updatedVariable = result.variables?.[0] as QueryVariableKind;
    expect(updatedVariable.spec.query?.spec?.datasource?.name).toBe('ds-uid');

    const updatedPanel = result.elements.panel as PanelKind;
    const queries = updatedPanel.spec.data?.kind === 'QueryGroup' ? updatedPanel.spec.data.spec.queries : [];
    const updatedQuery = queries[0];
    expect(updatedQuery?.spec?.datasource?.uid).toBe('ds-uid');
    expect(updatedQuery?.spec?.datasource?.type).toBe('prometheus');
  });
});
