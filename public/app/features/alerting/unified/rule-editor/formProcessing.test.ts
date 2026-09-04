import { mockAlertQuery, mockReduceExpression, mockThresholdExpression } from '../mocks';

import { getDefaultFormValues } from './formDefaults';
import { setQueryEditorSettings } from './formProcessing';

describe('setQueryEditorSettings', () => {
  it('should enable the simplified editor when queries are transformable', async () => {
    const result = await setQueryEditorSettings({
      ...getDefaultFormValues(),
      queries: [
        mockAlertQuery(),
        mockReduceExpression({ expression: 'A' }),
        mockThresholdExpression({ expression: 'B' }),
      ],
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
