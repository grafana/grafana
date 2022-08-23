import { LokiQueryModeller } from './LokiQueryModeller';
import { LokiOperationId } from './types';

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

  it('Can query with pipeline operation json', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: LokiOperationId.Json, params: [] }],
      })
    ).toBe('{app="grafana"} | json');
  });

  it('Can query with pipeline operation json and expression param', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: LokiOperationId.Json, params: ['foo="bar"'] }],
      })
    ).toBe('{app="grafana"} | json foo="bar"');
  });

  it('Can query with pipeline operation json and multiple expression params', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: LokiOperationId.Json, params: ['foo="bar", bar="baz"'] }],
      })
    ).toBe('{app="grafana"} | json foo="bar", bar="baz"');
  });

  it('Can query with pipeline operation logfmt', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: LokiOperationId.Logfmt, params: [] }],
      })
    ).toBe('{app="grafana"} | logfmt');
  });

  it('Can query with pipeline operation regexp', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: LokiOperationId.Regexp, params: ['re'] }],
      })
    ).toBe('{app="grafana"} | regexp `re`');
  });

  it('Can query with pipeline operation pattern', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: LokiOperationId.Pattern, params: ['<pattern>'] }],
      })
    ).toBe('{app="grafana"} | pattern `<pattern>`');
  });

  it('Can query with pipeline operation unpack', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: LokiOperationId.Unpack, params: [] }],
      })
    ).toBe('{app="grafana"} | unpack');
  });

  it('Can query with line filter contains operation', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: LokiOperationId.LineContains, params: ['error'] }],
      })
    ).toBe('{app="grafana"} |= `error`');
  });

  it('Can query with line filter contains operation with empty params', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: LokiOperationId.LineContains, params: [''] }],
      })
    ).toBe('{app="grafana"} |= ``');
  });

  it('Can query with line filter contains not operation', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: LokiOperationId.LineContainsNot, params: ['error'] }],
      })
    ).toBe('{app="grafana"} != `error`');
  });

  it('Can query with line regex filter', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: LokiOperationId.LineMatchesRegex, params: ['error'] }],
      })
    ).toBe('{app="grafana"} |~ `error`');
  });

  it('Can query with line not matching regex', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: LokiOperationId.LineMatchesRegexNot, params: ['error'] }],
      })
    ).toBe('{app="grafana"} !~ `error`');
  });

  it('Can query with label filter expression', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: LokiOperationId.LabelFilter, params: ['__error__', '=', 'value'] }],
      })
    ).toBe('{app="grafana"} | __error__ = `value`');
  });

  it('Can query with label filter expression using greater than operator', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: LokiOperationId.LabelFilter, params: ['count', '>', 'value'] }],
      })
    ).toBe('{app="grafana"} | count > value');
  });

  it('Can query no formatting errors operation', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: LokiOperationId.LabelFilterNoErrors, params: [] }],
      })
    ).toBe('{app="grafana"} | __error__=``');
  });

  it('Can query with unwrap operation', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: LokiOperationId.Unwrap, params: ['count'] }],
      })
    ).toBe('{app="grafana"} | unwrap count');
  });

  it('Can render with line_format operation', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: LokiOperationId.LineFormat, params: ['{{.status_code}}'] }],
      })
    ).toBe('{app="grafana"} | line_format `{{.status_code}}`');
  });

  it('Can render with label_format operation', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: LokiOperationId.LabelFormat, params: ['original', 'renameTo'] }],
      })
    ).toBe('{app="grafana"} | label_format renameTo=original');
  });

  it('Can render simply binary operation with scalar', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: LokiOperationId.MultiplyBy, params: [1000] }],
      })
    ).toBe('{app="grafana"} * 1000');
  });

  it('Can render query with simple binary query', () => {
    expect(
      modeller.renderQuery({
        labels: [{ label: 'app', op: '=', value: 'grafana' }],
        operations: [{ id: LokiOperationId.Rate, params: ['5m'] }],
        binaryQueries: [
          {
            operator: '/',
            query: {
              labels: [{ label: 'job', op: '=', value: 'backup' }],
              operations: [{ id: LokiOperationId.CountOverTime, params: ['5m'] }],
            },
          },
        ],
      })
    ).toBe('rate({app="grafana"} [5m]) / count_over_time({job="backup"} [5m])');
  });

  describe('On add operation handlers', () => {
    it('When adding function without range vector param should automatically add rate', () => {
      const query = {
        labels: [],
        operations: [],
      };

      const def = modeller.getOperationDef('sum')!;
      const result = def.addOperationHandler(def, query, modeller);
      expect(result.operations[0].id).toBe('rate');
      expect(result.operations[1].id).toBe('sum');
    });

    it('When adding function without range vector param should automatically add rate after existing pipe operation', () => {
      const query = {
        labels: [],
        operations: [{ id: LokiOperationId.Json, params: [] }],
      };

      const def = modeller.getOperationDef('sum')!;
      const result = def.addOperationHandler(def, query, modeller);
      expect(result.operations[0].id).toBe(LokiOperationId.Json);
      expect(result.operations[1].id).toBe('rate');
      expect(result.operations[2].id).toBe('sum');
    });

    it('When adding a pipe operation after a function operation should add pipe operation first', () => {
      const query = {
        labels: [],
        operations: [{ id: 'rate', params: [] }],
      };

      const def = modeller.getOperationDef(LokiOperationId.Json)!;
      const result = def.addOperationHandler(def, query, modeller);
      expect(result.operations[0].id).toBe(LokiOperationId.Json);
      expect(result.operations[1].id).toBe('rate');
    });

    it('When adding a pipe operation after a line filter operation', () => {
      const query = {
        labels: [],
        operations: [{ id: LokiOperationId.LineContains, params: ['error'] }],
      };

      const def = modeller.getOperationDef(LokiOperationId.Json)!;
      const result = def.addOperationHandler(def, query, modeller);
      expect(result.operations[0].id).toBe(LokiOperationId.LineContains);
      expect(result.operations[1].id).toBe(LokiOperationId.Json);
    });

    it('When adding a line filter operation after format operation', () => {
      const query = {
        labels: [],
        operations: [{ id: LokiOperationId.Json, params: [] }],
      };

      const def = modeller.getOperationDef(LokiOperationId.LineContains)!;
      const result = def.addOperationHandler(def, query, modeller);
      expect(result.operations[0].id).toBe(LokiOperationId.LineContains);
      expect(result.operations[1].id).toBe(LokiOperationId.Json);
    });

    it('When adding a rate it should not add another rate', () => {
      const query = {
        labels: [],
        operations: [{ id: LokiOperationId.Rate, params: [] }],
      };

      const def = modeller.getOperationDef(LokiOperationId.Rate)!;
      const result = def.addOperationHandler(def, query, modeller);
      expect(result.operations.length).toBe(1);
    });

    it('When adding unwrap it should be added after format and error filter', () => {
      const query = {
        labels: [],
        operations: [
          { id: LokiOperationId.Json, params: [] },
          { id: LokiOperationId.LabelFilterNoErrors, params: [] },
        ],
      };

      const def = modeller.getOperationDef(LokiOperationId.Unwrap)!;
      const result = def.addOperationHandler(def, query, modeller);
      expect(result.operations[1].id).toBe(LokiOperationId.Unwrap);
    });
  });
});
