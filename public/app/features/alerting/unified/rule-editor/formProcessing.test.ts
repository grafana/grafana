import { mockAlertQuery, mockDataSource, mockReduceExpression, mockThresholdExpression } from '../mocks';
import { setupDataSources } from '../testSetup/datasources';
import { DataSourceType } from '../utils/datasource';

import { getDefaultFormValues } from './formDefaults';
import { areQueriesTransformableToSimpleCondition, setQueryEditorSettings } from './formProcessing';

describe('areQueriesTransformableToSimpleCondition', () => {
  it('should return false when there is not exactly one data query', async () => {
    expect(await areQueriesTransformableToSimpleCondition([], [])).toBe(false);
    expect(
      await areQueriesTransformableToSimpleCondition([mockAlertQuery(), mockAlertQuery()], [mockThresholdExpression()])
    ).toBe(false);
  });

  it('should return false when there are more than two expressions', async () => {
    const result = await areQueriesTransformableToSimpleCondition(
      [mockAlertQuery()],
      [mockReduceExpression(), mockThresholdExpression(), mockThresholdExpression({ refId: 'D' })]
    );
    expect(result).toBe(false);
  });

  it('should return true for a strict reduce expression feeding a clean threshold expression', async () => {
    const result = await areQueriesTransformableToSimpleCondition(
      [mockAlertQuery()],
      [mockReduceExpression({ expression: 'A' }), mockThresholdExpression({ expression: 'B' })]
    );
    expect(result).toBe(true);
  });

  it('should return true for a single threshold expression pointing at an instant data query', async () => {
    setupDataSources(mockDataSource({ type: DataSourceType.Prometheus, name: 'prom', uid: 'prom-1' }));

    const dataQuery = mockAlertQuery({ datasourceUid: 'prom-1', model: { refId: 'A', instant: true } });
    const result = await areQueriesTransformableToSimpleCondition(
      [dataQuery],
      [mockThresholdExpression({ expression: 'A' })]
    );

    expect(result).toBe(true);
  });

  it('should return false for a single threshold expression pointing at a non-instant data query', async () => {
    setupDataSources(mockDataSource({ type: DataSourceType.Prometheus, name: 'prom', uid: 'prom-1' }));

    const dataQuery = mockAlertQuery({ datasourceUid: 'prom-1', model: { refId: 'A', instant: false } });
    const result = await areQueriesTransformableToSimpleCondition(
      [dataQuery],
      [mockThresholdExpression({ expression: 'A' })]
    );

    expect(result).toBe(false);
  });
});

describe('setQueryEditorSettings', () => {
  it('should enable the simplified editor when queries are transformable', async () => {
    const result = await setQueryEditorSettings({
      ...getDefaultFormValues(),
      queries: [mockAlertQuery(), mockReduceExpression({ expression: 'A' }), mockThresholdExpression({ expression: 'B' })],
    });

    expect(result.editorSettings?.simplifiedQueryEditor).toBe(true);
  });

  it('should disable the simplified editor when queries are not transformable', async () => {
    const result = await setQueryEditorSettings({
      ...getDefaultFormValues(),
      queries: [mockAlertQuery(), mockAlertQuery({ refId: 'B' }), mockThresholdExpression({ expression: 'C' })],
    });

    expect(result.editorSettings?.simplifiedQueryEditor).toBe(false);
  });
});
