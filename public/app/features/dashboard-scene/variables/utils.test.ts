import { TestVariable } from '@grafana/scenes';
import { variableAdapters } from 'app/features/variables/adapters';
import { createCustomVariableAdapter } from 'app/features/variables/custom/adapter';
import { createDataSourceVariableAdapter } from 'app/features/variables/datasource/adapter';
import { createQueryVariableAdapter } from 'app/features/variables/query/adapter';

import { createDependencyEdges, createDependencyNodes } from './utils';

variableAdapters.setInit(() => [
  createDataSourceVariableAdapter(),
  createCustomVariableAdapter(),
  createQueryVariableAdapter(),
]);

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
