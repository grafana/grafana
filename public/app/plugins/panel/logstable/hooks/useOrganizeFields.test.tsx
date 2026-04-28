import { renderHook, waitFor } from '@testing-library/react';

import { type DataFrame, DataFrameType, FieldType, standardEditorsRegistry, toDataFrame } from '@grafana/data';
// Internal package imports, but not exposed to end users, how do we expect plugin developers to test anything that contains a transform?
import { mockTransformationsRegistry, organizeFieldsTransformer } from '@grafana/data/internal';
import { TableCellDisplayMode } from '@grafana/ui/types';
import { getAllOptionEditors } from 'app/core/components/OptionsUI/registry';
import { LOG_LINE_BODY_FIELD_NAME } from 'app/features/logs/components/fieldSelector/logFields';
import { LOGS_DATAPLANE_BODY_NAME, LOGS_DATAPLANE_TIMESTAMP_NAME, parseLogsFrame } from 'app/features/logs/logsFrame';
import { extractFieldsTransformer } from 'app/features/transformers/extractFields/extractFields';

import { DEFAULT_LOG_LEVEL_FIELD_WIDTH } from '../constants';

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
    try {
      standardEditorsRegistry.setInit(getAllOptionEditors);
    } catch {
      // already initialized in this Jest worker
    }
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
          levelFieldName: 'level',
          logsFrame: testLogsFrame,
          onPermalinkClick: () => null,
          options: {},
          supportsPermalink: false,
          timeFieldName: LOGS_DATAPLANE_TIMESTAMP_NAME,
          fieldConfig: { defaults: {}, overrides: [] },
        })
      );

      await waitFor(() => {
        expect(organizedFields.current.organizedFrame).not.toBeNull();
        expect(organizedFields.current.organizedFrame?.fields.length).toBe(3);
        expect(organizedFields.current.organizedFrame?.fields[0].name).toBe(LOGS_DATAPLANE_TIMESTAMP_NAME);
        expect(organizedFields.current.organizedFrame?.fields[1].name).toBe('level');
        expect(organizedFields.current.organizedFrame?.fields[2].name).toBe(LOGS_DATAPLANE_BODY_NAME);
      });
    });
    test('returns specified fields', async () => {
      const { result: organizedFields } = renderHook(() =>
        useOrganizeFields({
          extractedFrame,
          bodyFieldName: LOGS_DATAPLANE_BODY_NAME,
          levelFieldName: 'level',
          logsFrame: testLogsFrame,
          onPermalinkClick: () => null,
          options: {
            displayedFields: ['service', 'level'],
          },
          supportsPermalink: false,
          timeFieldName: LOGS_DATAPLANE_TIMESTAMP_NAME,
          fieldConfig: { defaults: {}, overrides: [] },
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
    test('only used on first column - enableLogDetails', async () => {
      const { result: organizedFields } = renderHook(() =>
        useOrganizeFields({
          extractedFrame,
          bodyFieldName: LOGS_DATAPLANE_BODY_NAME,
          levelFieldName: 'level',
          logsFrame: testLogsFrame,
          onPermalinkClick: () => null,
          options: {
            enableLogDetails: true,
          },
          supportsPermalink: false,
          timeFieldName: LOGS_DATAPLANE_TIMESTAMP_NAME,
          fieldConfig: { defaults: {}, overrides: [] },
        })
      );
      await waitFor(() => {
        expect(organizedFields.current.organizedFrame).not.toBeNull();
        expect(organizedFields.current.organizedFrame?.fields.length).toBe(3);
        expect(organizedFields.current.organizedFrame?.fields[0].config.custom.cellOptions.type).toBe(
          TableCellDisplayMode.Custom
        );
        expect(organizedFields.current.organizedFrame?.fields[1].config.custom.cellOptions.type).toBe(
          TableCellDisplayMode.Pill
        );
        expect(organizedFields.current.organizedFrame?.fields[2].config.custom.cellOptions).not.toBeDefined();
      });
    });
    test('only used on first column - showCopyLogLink', async () => {
      const { result: organizedFields } = renderHook(() =>
        useOrganizeFields({
          extractedFrame,
          bodyFieldName: LOGS_DATAPLANE_BODY_NAME,
          levelFieldName: 'level',
          logsFrame: testLogsFrame,
          onPermalinkClick: () => null,
          options: {
            showCopyLogLink: true,
          },
          supportsPermalink: true,
          timeFieldName: LOGS_DATAPLANE_TIMESTAMP_NAME,
          fieldConfig: { defaults: {}, overrides: [] },
        })
      );
      await waitFor(() => {
        expect(organizedFields.current.organizedFrame).not.toBeNull();
        expect(organizedFields.current.organizedFrame?.fields.length).toBe(3);
        expect(organizedFields.current.organizedFrame?.fields[0].config.custom.cellOptions.type).toBe(
          TableCellDisplayMode.Custom
        );
        expect(organizedFields.current.organizedFrame?.fields[1].config.custom.cellOptions.type).toBe(
          TableCellDisplayMode.Pill
        );
        expect(organizedFields.current.organizedFrame?.fields[2].config.custom.cellOptions).not.toBeDefined();
      });
    });
    test('not used if enableLogDetails is false and showCopyLogLink is not set', async () => {
      const { result: organizedFields } = renderHook(() =>
        useOrganizeFields({
          extractedFrame,
          bodyFieldName: LOGS_DATAPLANE_BODY_NAME,
          levelFieldName: 'level',
          logsFrame: testLogsFrame,
          onPermalinkClick: () => null,
          options: { enableLogDetails: false },
          supportsPermalink: false,
          timeFieldName: LOGS_DATAPLANE_TIMESTAMP_NAME,
          fieldConfig: { defaults: {}, overrides: [] },
        })
      );

      await waitFor(() => {
        expect(organizedFields.current.organizedFrame).not.toBeNull();
        expect(organizedFields.current.organizedFrame?.fields[0].config.custom.cellOptions).not.toBeDefined();
      });
    });

    test('log line body has no cellOptions when it is moved from the first position', async () => {
      const optionsBodyFirst = {
        displayedFields: [LOG_LINE_BODY_FIELD_NAME, LOGS_DATAPLANE_TIMESTAMP_NAME, 'level'],
        enableLogDetails: true,
      };
      const optionsBodySecond = {
        displayedFields: [LOGS_DATAPLANE_TIMESTAMP_NAME, LOG_LINE_BODY_FIELD_NAME, 'level'],
        enableLogDetails: true,
      };

      const { result, rerender } = renderHook(
        (options: typeof optionsBodyFirst, frame = extractedFrame) =>
          useOrganizeFields({
            extractedFrame: frame,
            bodyFieldName: LOGS_DATAPLANE_BODY_NAME,
            levelFieldName: 'level',
            logsFrame: testLogsFrame,
            onPermalinkClick: () => null,
            options,
            supportsPermalink: false,
            timeFieldName: LOGS_DATAPLANE_TIMESTAMP_NAME,
            fieldConfig: { defaults: {}, overrides: [] },
          }),
        { initialProps: optionsBodyFirst }
      );

      await waitFor(() => {
        const frame = result.current.organizedFrame;
        expect(frame).not.toBeNull();
        expect(frame!.fields[0].name).toBe(LOGS_DATAPLANE_BODY_NAME);
        const bodyField = frame!.fields.find((f) => f.name === LOGS_DATAPLANE_BODY_NAME);
        expect(bodyField?.config.custom?.cellOptions).toBeDefined();
      });

      rerender(optionsBodySecond);

      await waitFor(() => {
        const frame = result.current.organizedFrame;
        expect(frame).not.toBeNull();
        expect(frame!.fields[1].name).toBe(LOGS_DATAPLANE_BODY_NAME);
        const bodyField = frame!.fields.find((f) => f.name === LOGS_DATAPLANE_BODY_NAME);
        expect(bodyField?.config.custom?.cellOptions).not.toBeDefined();
      });
    });

    test('fieldConfig defaults', async () => {
      const { result: organizedFields } = renderHook(() =>
        useOrganizeFields({
          extractedFrame,
          bodyFieldName: LOGS_DATAPLANE_BODY_NAME,
          levelFieldName: 'level',
          logsFrame: testLogsFrame,
          onPermalinkClick: () => null,
          options: {},
          supportsPermalink: false,
          timeFieldName: LOGS_DATAPLANE_TIMESTAMP_NAME,
          fieldConfig: { defaults: { custom: { filterable: true } }, overrides: [] },
        })
      );

      await waitFor(() => {
        expect(organizedFields.current.organizedFrame).not.toBeNull();
        expect(organizedFields.current.organizedFrame?.fields[0].config.custom.filterable).toBe(true);
      });
    });
  });

  describe('log level column enhancements', () => {
    test('applies default level mapping and pill cell mode for level field', async () => {
      const { result: organizedFields } = renderHook(() =>
        useOrganizeFields({
          extractedFrame,
          bodyFieldName: LOGS_DATAPLANE_BODY_NAME,
          levelFieldName: 'level',
          logsFrame: testLogsFrame,
          onPermalinkClick: () => null,
          options: {},
          supportsPermalink: false,
          timeFieldName: LOGS_DATAPLANE_TIMESTAMP_NAME,
          fieldConfig: { defaults: {}, overrides: [] },
        })
      );

      expect.assertions(7);

      await waitFor(() => {
        const levelField = organizedFields.current.organizedFrame?.fields.find((f) => f.name === 'level');
        expect(levelField).toBeDefined();
        expect(levelField?.config.custom?.cellOptions?.type).toBe(TableCellDisplayMode.Pill);
        expect(levelField?.config.custom?.width).toBe(DEFAULT_LOG_LEVEL_FIELD_WIDTH);
        if (levelField?.config.mappings?.[0]?.options && 'critical' in levelField?.config.mappings?.[0]?.options) {
          expect(levelField?.config.mappings?.[0]?.options?.['critical']).toBeDefined();
        }
      });
    });
  });
});
