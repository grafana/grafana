import { LokiQueryModeller } from './LokiQueryModeller';

describe('LokiQueryModeller', () => {
  const modeller = new LokiQueryModeller();

  it('Can query with labels only', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [],
      })
    ).toBe('{app="grafana"}');
  });

  it('Can query with labels and search', () => {
    expect(
      modeller.renderQuery({
        search: 'error',
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [],
      })
    ).toBe('{app="grafana"} |= "error"');
  });

  it('Can query with pipeline operation json', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: 'json', params: [] }],
      })
    ).toBe('{app="grafana"} | json');
  });

  it('Can query with pipeline operation logfmt', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: 'logfmt', params: [] }],
      })
    ).toBe('{app="grafana"} | logfmt');
  });

  describe('On add operation handlers', () => {
    it('When adding function without range vector param should automatically add rate', () => {
      const query = {
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [],
      };

      const def = modeller.getOperationDef('sum');
      const result = def.addOperationHandler(def, query, modeller);
      expect(result.operations[0].id).toBe('rate');
      expect(result.operations[1].id).toBe('sum');
    });

    it('When adding function without range vector param should automatically add rate after existing pipe operation', () => {
      const query = {
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: 'json', params: [] }],
      };

      const def = modeller.getOperationDef('sum');
      const result = def.addOperationHandler(def, query, modeller);
      expect(result.operations[0].id).toBe('json');
      expect(result.operations[1].id).toBe('rate');
      expect(result.operations[2].id).toBe('sum');
    });

    it('When adding a pipe operation after a function operation should add pipe operation first', () => {
      const query = {
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: 'rate', params: [] }],
      };

      const def = modeller.getOperationDef('json');
      const result = def.addOperationHandler(def, query, modeller);
      expect(result.operations[0].id).toBe('json');
      expect(result.operations[1].id).toBe('rate');
    });
  });
});
