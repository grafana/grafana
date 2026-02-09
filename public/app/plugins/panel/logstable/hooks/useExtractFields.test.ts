import { renderHook, waitFor } from '@testing-library/react';

import { DataFrameType, FieldType, toDataFrame } from '@grafana/data';
import { LOGS_DATAPLANE_BODY_NAME, LOGS_DATAPLANE_TIMESTAMP_NAME } from 'app/features/logs/logsFrame';
// Internal package imports, but not exposed to end users, how do we expect plugin developers to test anything that contains a transform?
import { extractFieldsTransformer } from 'app/features/transformers/extractFields/extractFields';

import { mockTransformationsRegistry } from '../../../../../../packages/grafana-data/src/utils/tests/mockTransformationsRegistry';

import { useExtractFields } from './useExtractFields';

const testLogsDataFrame = [
  toDataFrame({
    meta: {
      type: DataFrameType.LogLines,
    },
    fields: [
      { name: LOGS_DATAPLANE_TIMESTAMP_NAME, type: FieldType.time, values: [1, 2] },
      { name: LOGS_DATAPLANE_BODY_NAME, type: FieldType.string, values: ['log 1', 'log 2'] },
      {
        name: 'labels',
        type: FieldType.other,
        values: [
          { service: 'frontend', level: 'info' },
          { service: 'backend', level: 'error' },
        ],
      },
    ],
  }),
];

describe('useExtractFields', () => {
  beforeAll(() => {
    mockTransformationsRegistry([extractFieldsTransformer]);
  });

  test('returns extracted fields', async () => {
    const { result } = renderHook(() =>
      useExtractFields({
        rawTableFrame: testLogsDataFrame[0],
        timeZone: 'utc',
        fieldConfig: {
          defaults: {},
          overrides: [],
        },
      })
    );

    await waitFor(() => {
      expect(result.current.extractedFrame?.fields[0].name).toBe(LOGS_DATAPLANE_TIMESTAMP_NAME);
      expect(result.current.extractedFrame?.fields[1].name).toBe(LOGS_DATAPLANE_BODY_NAME);
      expect(result.current.extractedFrame?.fields[2].name).toBe('labels');
      expect(result.current.extractedFrame?.fields[3].name).toBe('service');
      expect(result.current.extractedFrame?.fields[4].name).toBe('level');
    });
  });
});
