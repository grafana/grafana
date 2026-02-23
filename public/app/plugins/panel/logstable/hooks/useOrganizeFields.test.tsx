import { renderHook, waitFor } from '@testing-library/react';

import { DataFrame, DataFrameType, FieldType, toDataFrame } from '@grafana/data';
// Internal package imports, but not exposed to end users, how do we expect plugin developers to test anything that contains a transform?
import { mockTransformationsRegistry, organizeFieldsTransformer } from '@grafana/data/internal';
import { TableCellDisplayMode } from '@grafana/ui';
import { LOGS_DATAPLANE_BODY_NAME, LOGS_DATAPLANE_TIMESTAMP_NAME, parseLogsFrame } from 'app/features/logs/logsFrame';
import { extractFieldsTransformer } from 'app/features/transformers/extractFields/extractFields';

import { useExtractFields } from './useExtractFields';
import { useOrganizeFields } from './useOrganizeFields';

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
const testLogsFrame = parseLogsFrame(testLogsDataFrame[0]);

describe('useOrganizeFields', () => {
  beforeAll(() => {
    mockTransformationsRegistry([organizeFieldsTransformer, extractFieldsTransformer]);
  });

  let extractedFrame: DataFrame;

  beforeEach(async () => {
    const result = renderHook(() =>
      useExtractFields({
        rawTableFrame: testLogsDataFrame[0],
        timeZone: 'utc',
        fieldConfig: {
          defaults: {},
          overrides: [],
        },
      })
    );

    await waitFor(() => expect(result.result.current.extractedFrame).not.toBeNull());
    if (result.result.current.extractedFrame) {
      extractedFrame = result.result.current.extractedFrame;
    } else {
      throw new Error('Failed to extract labels!');
    }
  });

  describe('displayed fields', () => {
    test('returns default fields', async () => {
      const { result: organizedFields } = renderHook(() =>
        useOrganizeFields({
          extractedFrame,
          bodyFieldName: LOGS_DATAPLANE_BODY_NAME,
          logsFrame: testLogsFrame,
          onPermalinkClick: () => null,
          options: {},
          supportsPermalink: false,
          timeFieldName: LOGS_DATAPLANE_TIMESTAMP_NAME,
        })
      );

      await waitFor(() => {
        expect(organizedFields.current.organizedFrame).not.toBeNull();
        expect(organizedFields.current.organizedFrame?.fields.length).toBe(2);
        expect(organizedFields.current.organizedFrame?.fields[0].name).toBe(LOGS_DATAPLANE_TIMESTAMP_NAME);
        expect(organizedFields.current.organizedFrame?.fields[1].name).toBe(LOGS_DATAPLANE_BODY_NAME);
      });
    });
    test('returns specified fields', async () => {
      const { result: organizedFields } = renderHook(() =>
        useOrganizeFields({
          extractedFrame,
          bodyFieldName: LOGS_DATAPLANE_BODY_NAME,
          logsFrame: testLogsFrame,
          onPermalinkClick: () => null,
          options: {
            displayedFields: ['service', 'level'],
          },
          supportsPermalink: false,
          timeFieldName: LOGS_DATAPLANE_TIMESTAMP_NAME,
        })
      );

      await waitFor(() => {
        expect(organizedFields.current.organizedFrame).not.toBeNull();
        expect(organizedFields.current.organizedFrame?.fields.length).toBe(2);
        expect(organizedFields.current.organizedFrame?.fields[0].name).toBe('service');
        expect(organizedFields.current.organizedFrame?.fields[1].name).toBe('level');
      });
    });
  });
  describe('custom cell renderer', () => {
    test('only used on first column - showInspectLogLine', async () => {
      const { result: organizedFields } = renderHook(() =>
        useOrganizeFields({
          extractedFrame,
          bodyFieldName: LOGS_DATAPLANE_BODY_NAME,
          logsFrame: testLogsFrame,
          onPermalinkClick: () => null,
          options: {
            showInspectLogLine: true,
          },
          supportsPermalink: false,
          timeFieldName: LOGS_DATAPLANE_TIMESTAMP_NAME,
        })
      );
      await waitFor(() => {
        expect(organizedFields.current.organizedFrame).not.toBeNull();
        expect(organizedFields.current.organizedFrame?.fields.length).toBe(2);
        expect(organizedFields.current.organizedFrame?.fields[0].config.custom.cellOptions.type).toBe(
          TableCellDisplayMode.Custom
        );
        expect(organizedFields.current.organizedFrame?.fields[1].config.custom.cellOptions).not.toBeDefined();
      });
    });
    test('only used on first column - showCopyLogLink', async () => {
      const { result: organizedFields } = renderHook(() =>
        useOrganizeFields({
          extractedFrame,
          bodyFieldName: LOGS_DATAPLANE_BODY_NAME,
          logsFrame: testLogsFrame,
          onPermalinkClick: () => null,
          options: {
            showCopyLogLink: true,
          },
          supportsPermalink: true,
          timeFieldName: LOGS_DATAPLANE_TIMESTAMP_NAME,
        })
      );
      await waitFor(() => {
        expect(organizedFields.current.organizedFrame).not.toBeNull();
        expect(organizedFields.current.organizedFrame?.fields.length).toBe(2);
        expect(organizedFields.current.organizedFrame?.fields[0].config.custom.cellOptions.type).toBe(
          TableCellDisplayMode.Custom
        );
        expect(organizedFields.current.organizedFrame?.fields[1].config.custom.cellOptions).not.toBeDefined();
      });
    });
    test('not used if showInspectLogLine or showCopyLogLink is not defined', async () => {
      const { result: organizedFields } = renderHook(() =>
        useOrganizeFields({
          extractedFrame,
          bodyFieldName: LOGS_DATAPLANE_BODY_NAME,
          logsFrame: testLogsFrame,
          onPermalinkClick: () => null,
          options: {},
          supportsPermalink: false,
          timeFieldName: LOGS_DATAPLANE_TIMESTAMP_NAME,
        })
      );

      await waitFor(() => {
        expect(organizedFields.current.organizedFrame).not.toBeNull();
        expect(organizedFields.current.organizedFrame?.fields[0].config.custom.cellOptions).not.toBeDefined();
      });
    });
  });
});
