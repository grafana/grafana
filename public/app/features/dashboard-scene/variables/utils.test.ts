import { TestVariable } from '@grafana/scenes';
import { Dashboard } from '@grafana/schema';
import { variableAdapters } from 'app/features/variables/adapters';
import { createCustomVariableAdapter } from 'app/features/variables/custom/adapter';
import { createDataSourceVariableAdapter } from 'app/features/variables/datasource/adapter';
import { createQueryVariableAdapter } from 'app/features/variables/query/adapter';

import {
  createDependencyEdges,
  getVariableName,
  createDependencyNodes,
  createUsagesNetwork,
  transformUsagesToNetwork,
} from './utils';

variableAdapters.setInit(() => [
  createDataSourceVariableAdapter(),
  createCustomVariableAdapter(),
  createQueryVariableAdapter(),
]);

const dashboardMock: Dashboard = {
  panels: [
    {
      datasource: {
        type: 'prometheus',
        uid: 'gdev-prometheus',
      },
      targets: [
        {
          datasource: {
            type: 'prometheus',
            uid: 'gdev-prometheus',
          },
          disableTextWrap: false,
          editorMode: 'code',
          expr: 'go_gc_duration_seconds{job=$query0)',
          fullMetaSearch: false,
          includeNullMetadata: true,
          instant: false,
          legendFormat: '__auto',
          range: true,
          refId: 'A',
          useBackend: false,
        },
        {
          datasource: {
            type: 'prometheus',
            uid: 'gdev-prometheus',
          },
          disableTextWrap: false,
          editorMode: 'code',
          expr: 'go_gc_duration_seconds{job=$query1)',
          fullMetaSearch: false,
          includeNullMetadata: true,
          instant: false,
          legendFormat: '__auto',
          range: true,
          refId: 'A',
          useBackend: false,
        },
      ],
      title: 'Panel Title',
      type: 'timeseries',
    },
  ],
  schemaVersion: 40,
};

describe('createDependencyNodes', () => {
  it('should create node for each variable', () => {
    const variables = [
      new TestVariable({ name: 'A', query: 'A.*', value: '', text: '', options: [] }),
      new TestVariable({ name: 'B', query: 'B.*', value: '', text: '', options: [] }),
      new TestVariable({ name: 'C', query: 'C.*', value: '', text: '', options: [] }),
    ];
    const graphNodes = createDependencyNodes(variables);
    expect(graphNodes[0].id).toBe('A');
    expect(graphNodes[1].id).toBe('B');
    expect(graphNodes[2].id).toBe('C');
  });
});

describe('createDependencyEdges', () => {
  it('should create edges for variable dependencies', () => {
    const variables = [
      new TestVariable({ name: 'A', query: 'A.*', value: '', text: '', options: [] }),
      new TestVariable({ name: 'B', query: '${A}.*', value: '', text: '', options: [] }),
      new TestVariable({ name: 'C', query: '${B}.*', value: '', text: '', options: [] }),
    ];
    const graphEdges = createDependencyEdges(variables);
    expect(graphEdges).toContainEqual({ from: 'B', to: 'A' });
    expect(graphEdges).toContainEqual({ from: 'C', to: 'B' });
  });
});

describe('createUsagesNetwork', () => {
  it('should create usage network for variables', () => {
    const variables = [
      new TestVariable({
        type: 'query',
        name: 'query0',
        loading: false,
        error: null,
      }),
      new TestVariable({
        type: 'query',
        name: 'query1',
        loading: false,
        error: null,
      }),
    ];

    const usagesNetwork = createUsagesNetwork(variables, dashboardMock);
    expect(usagesNetwork).toHaveLength(2);
    expect(usagesNetwork[0].variable.state.name).toBe('query0');
    expect(usagesNetwork[1].variable.state.name).toBe('query1');
  });

  it('should not create usage network for variables that are not part of the dashboard', () => {
    const variables = [
      new TestVariable({
        type: 'query',
        name: 'query3',
        loading: false,
        error: null,
      }),
    ];

    const usagesNetwork = createUsagesNetwork(variables, dashboardMock);
    expect(usagesNetwork).toHaveLength(0);
  });
});

describe('transformUsagesToNetwork', () => {
  it('should transform usages to network', () => {
    const variables = [
      new TestVariable({ name: 'A', query: 'A.*', value: '', text: '', options: [] }),
      new TestVariable({ name: 'B', query: 'B.*', value: '', text: '', options: [] }),
    ];
    const usages = [
      { variable: variables[0], tree: { key: 'value' } },
      { variable: variables[1], tree: { key: 'value' } },
    ];

    const network = transformUsagesToNetwork(usages);
    expect(network).toHaveLength(2);
    expect(network[0].nodes).toContainEqual({ id: 'dashboard', label: 'dashboard' });
    expect(network[0].edges).toHaveLength(2);
  });
});

describe('getVariableName', () => {
  it('should return undefined if no match is found', () => {
    expect(getVariableName('no variable here')).toBeUndefined();
  });

  it('should return undefined if variable matches inherited object prop names', () => {
    expect(getVariableName('${toString}')).toBeUndefined();
  });

  it('should return the variable name if it exists and does not match inherited object prop names', () => {
    expect(getVariableName('${myVariable}')).toBe('myVariable');
  });
});
