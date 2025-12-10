import { alertingAlertRuleFormSchema, alertingModelSchema } from './alertRuleFormSchema';

describe('alertingModelSchema', () => {
  it('should allow threshold expression model', () => {
    const model = {
      conditions: [
        {
          evaluator: { params: [0.0001, 0], type: 'gt' },
          operator: { type: 'and' },
          query: { params: [] },
          reducer: { params: [], type: 'avg' },
          type: 'query',
        },
      ],
      datasource: { name: 'Expression', type: '__expr__', uid: '__expr__' },
      expression: 'A',
      intervalMs: 1000,
      maxDataPoints: 43200,
      refId: 'C',
      type: 'threshold',
    };

    const result = alertingModelSchema.parse(model);
    expect(result.type).toBe('threshold');
    expect(result.conditions).toBeDefined();
  });

  it('should allow reduce expression model', () => {
    const model = {
      expression: 'A',
      intervalMs: 1000,
      maxDataPoints: 100,
      reducer: 'mean',
      refId: 'B',
      type: 'reduce',
    };

    const result = alertingModelSchema.parse(model);
    expect(result.type).toBe('reduce');
    expect(result.reducer).toBe('mean');
  });

  it('should allow math expression model', () => {
    const model = {
      expression: '$B > 0.4',
      intervalMs: 1000,
      maxDataPoints: 43200,
      refId: 'C',
      type: 'math',
    };

    const result = alertingModelSchema.parse(model);
    expect(result.type).toBe('math');
    expect(result.expression).toBe('$B > 0.4');
  });

  it('should allow Prometheus query model', () => {
    const model = {
      datasource: { type: 'prometheus', uid: 'gdev-prometheus' },
      editorMode: 'code',
      expr: 'up',
      instant: true,
      range: false,
      refId: 'A',
    };

    const result = alertingModelSchema.parse(model);
    expect(result.expr).toBe('up');
    expect(result.instant).toBe(true);
  });

  it('should not add default values', () => {
    const model = { refId: 'A' };

    const result = alertingModelSchema.parse(model);
    expect(result).not.toHaveProperty('instant');
    expect(result).not.toHaveProperty('range');
    expect(result).not.toHaveProperty('queryType');
    expect(result).not.toHaveProperty('expression');
  });
});

describe('alertingAlertRuleFormSchema', () => {
  it('should validate alert rule with mixed query types', () => {
    const alertRule = {
      folder: { uid: 'folder-uid', title: 'Test Folder' },
      group: 'test-group',
      queries: [
        {
          refId: 'A',
          datasourceUid: 'gdev-prometheus',
          queryType: '',
          relativeTimeRange: { from: 600, to: 0 },
          model: {
            datasource: { type: 'prometheus', uid: 'gdev-prometheus' },
            expr: 'up',
            instant: true,
            range: false,
            refId: 'A',
          },
        },
        {
          refId: 'B',
          datasourceUid: '__expr__',
          queryType: '',
          model: {
            expression: 'A',
            reducer: 'mean',
            refId: 'B',
            type: 'reduce',
          },
        },
        {
          refId: 'C',
          datasourceUid: '__expr__',
          queryType: '',
          model: {
            conditions: [
              {
                evaluator: { params: [0], type: 'gt' },
                operator: { type: 'and' },
                query: { params: [] },
                reducer: { params: [], type: 'avg' },
                type: 'query',
              },
            ],
            datasource: { type: '__expr__', uid: '__expr__' },
            expression: 'B',
            refId: 'C',
            type: 'threshold',
          },
        },
      ],
      condition: 'C',
    };

    const result = alertingAlertRuleFormSchema.parse(alertRule);
    const queries = result.queries || [];
    expect(queries[0].model.expr).toBe('up');
    expect(queries[1].model.type).toBe('reduce');
    expect(queries[2].model.type).toBe('threshold');
  });

  it('should handle minimal payload from group details page', () => {
    const minimalPayload = {
      folder: { uid: 'folder-uid', title: 'Alpha squad' },
      group: 'alpha_squad_api_service_rules',
    };

    const result = alertingAlertRuleFormSchema.parse(minimalPayload);
    expect(result.folder?.uid).toBe('folder-uid');
    expect(result.folder?.title).toBe('Alpha squad');
    expect(result.group).toBe('alpha_squad_api_service_rules');

    // Verify no defaults are added for optional fields that weren't provided
    expect(result.name).toBeUndefined();
    expect(result.condition).toBeUndefined();
    expect(result.noDataState).toBeUndefined();
    expect(result.execErrState).toBeUndefined();
    expect(result.evaluateEvery).toBeUndefined();
    expect(result.evaluateFor).toBeUndefined();
    expect(result.keepFiringFor).toBeUndefined();
    expect(result.metric).toBeUndefined();
    expect(result.targetDatasourceUid).toBeUndefined();
    expect(result.returnTo).toBeUndefined();
    expect(result.annotations).toBeUndefined();
  });
});
