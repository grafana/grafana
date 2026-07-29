import { render, waitFor } from '@testing-library/react';
import { useMemo, useState } from 'react';

import {
  type DataFrame,
  DataFrameType,
  type DataTransformerInfo,
  EventBusSrv,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
  type PanelData,
  standardEditorsRegistry,
  toDataFrame,
} from '@grafana/data';
// Internal package imports, but not exposed to end users, how do we expect plugin developers to test anything that contains a transform?
import { mockTransformationsRegistry, organizeFieldsTransformer } from '@grafana/data/internal';
import { type DataTransformerConfig } from '@grafana/schema';
import { type PanelContext, PanelContextProvider, TableCellDisplayMode } from '@grafana/ui';
import { getAllOptionEditors } from 'app/core/components/OptionsUI/registry';
import { LOG_LINE_BODY_FIELD_NAME } from 'app/features/logs/components/fieldSelector/logFields';
import { LOGS_DATAPLANE_BODY_NAME, LOGS_DATAPLANE_TIMESTAMP_NAME, parseLogsFrame } from 'app/features/logs/logsFrame';
import { extractFieldsTransformer } from 'app/features/transformers/extractFields/extractFields';

import { DEFAULT_LOG_LEVEL_FIELD_WIDTH } from '../constants';
import type { Options as LogsTableOptions } from '../panelcfg.gen';

import { useDecorateFields } from './useDecorateFields';
import { useLogsTableTransformations } from './useLogsTableTransformations';

const testLogsDataFrame = toDataFrame({
  meta: { type: DataFrameType.LogLines },
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
});

const testLogsFrame = parseLogsFrame(testLogsDataFrame);

/** Stands in for whatever the user added in the transformations editor. */
const noopTransformer: DataTransformerInfo = {
  id: 'noop',
  name: 'Noop',
  description: '',
  defaultOptions: {},
  operator: () => (source) => source,
};

interface SetupOptions {
  options?: LogsTableOptions;
  /** Entries an editor authored, which must survive and stay between the panel's own entries. */
  editorTransformations?: DataTransformerConfig[];
  supportsPermalink?: boolean;
  /** Simulates a host that hands over no pipeline at all, i.e. Explore. */
  withoutHostPipeline?: boolean;
}

interface HookResult {
  frame: DataFrame;
  availableFieldsFrame: DataFrame | null;
}

const data: PanelData = {
  state: LoadingState.Done,
  timeRange: getDefaultTimeRange(),
  series: [testLogsDataFrame],
};

function setup({
  options = {},
  editorTransformations = [],
  supportsPermalink = false,
  withoutHostPipeline = false,
}: SetupOptions = {}) {
  // availableFieldsFrame is what `settled` gates on, so `frame` is never read before it is real.
  const result: { current: HookResult } = { current: { frame: testLogsDataFrame, availableFieldsFrame: null } };
  const pipelineRef: { current: DataTransformerConfig[] } = { current: editorTransformations };
  const setTransformations = jest.fn();

  function Panel({ options }: { options: LogsTableOptions }) {
    const { data: transformed, availableFieldsFrame } = useLogsTableTransformations({
      data,
      rawTableFrame: testLogsDataFrame,
      frameIndex: 0,
      fieldConfig: { defaults: { custom: { filterable: true } }, overrides: [] },
      timeZone: 'utc',
      options,
      timeFieldName: LOGS_DATAPLANE_TIMESTAMP_NAME,
      levelFieldName: 'level',
      bodyFieldName: LOGS_DATAPLANE_BODY_NAME,
    });

    const decorated = useDecorateFields({
      data: transformed,
      frameIndex: 0,
      timeFieldName: LOGS_DATAPLANE_TIMESTAMP_NAME,
      levelFieldName: 'level',
      bodyFieldName: LOGS_DATAPLANE_BODY_NAME,
      options,
      logsFrame: testLogsFrame,
      supportsPermalink,
      onPermalinkClick: () => null,
    });

    result.current = { frame: decorated.series[0], availableFieldsFrame };

    return null;
  }

  /**
   * Stands in for the dashboard: holds the pipeline and re-renders the panel when it changes, which
   * is what SceneDataTransformer does through VizPanelRenderer's state subscription.
   */
  function Host({ options }: { options: LogsTableOptions }) {
    const [pipeline, setPipeline] = useState(editorTransformations);
    pipelineRef.current = pipeline;

    const context = useMemo<PanelContext>(
      () => ({
        eventsScope: 'test',
        eventBus: new EventBusSrv(),
        ...(withoutHostPipeline
          ? {}
          : {
              isAdHocTransformsEnabled: () => true,
              getTransformations: () => pipeline,
              setTransformations: (next: DataTransformerConfig[]) => {
                setTransformations(next);
                setPipeline(next);
              },
              getUntransformedData: () => data,
            }),
      }),
      [pipeline]
    );

    return (
      <PanelContextProvider value={context}>
        <Panel options={options} />
      </PanelContextProvider>
    );
  }

  const { rerender } = render(<Host options={options} />);

  return {
    result,
    rerender: (next: LogsTableOptions) => rerender(<Host options={next} />),
    setTransformations,
    getPipeline: () => pipelineRef.current,
  };
}

/** Waits until the pipeline has settled and the organize transform has produced a frame. */
async function settled(result: { current: HookResult }) {
  await waitFor(() => expect(result.current.availableFieldsFrame).not.toBeNull());
}

beforeAll(() => {
  try {
    standardEditorsRegistry.setInit(getAllOptionEditors);
  } catch {
    // already initialized in this Jest worker
  }
  mockTransformationsRegistry([organizeFieldsTransformer, extractFieldsTransformer, noopTransformer]);
});

describe('useLogsTableTransformations', () => {
  describe('pipeline', () => {
    it('puts extractFields first and organize last', async () => {
      const { result, getPipeline } = setup();

      await settled(result);

      expect(getPipeline().map((t) => t.id)).toEqual(['extractFields', 'organize']);
    });

    it('stamps both entries as panel-authored', async () => {
      const { result, getPipeline } = setup();

      await settled(result);

      expect(getPipeline().every((t) => t.origin?.source === 'panel')).toBe(true);
    });

    // The whole point of the ordering: a user transformation sees the extracted label columns, and
    // the column selection applies to whatever the user's transformation produced.
    it('keeps editor entries between its own', async () => {
      const { result, getPipeline } = setup({
        editorTransformations: [{ id: 'noop', options: {}, origin: { source: 'editor' } }],
      });

      await settled(result);

      expect(getPipeline().map((t) => [t.id, t.origin?.source])).toEqual([
        ['extractFields', 'panel'],
        ['noop', 'editor'],
        ['organize', 'panel'],
      ]);
    });

    // Rows are drag-reorderable in the transformations editor, so the panel's entries can end up on
    // the wrong side of the user's. They are derived, so they get pinned back.
    it('restores its own entries to the ends when an editor entry is dragged past them', async () => {
      const { result, getPipeline } = setup({
        editorTransformations: [
          { id: 'organize', options: { includeByName: {}, indexByName: {} }, origin: { source: 'panel' } },
          { id: 'extractFields', options: { format: 'json', source: 'labels' }, origin: { source: 'panel' } },
          { id: 'noop', options: {}, origin: { source: 'editor' } },
        ],
      });

      await settled(result);

      expect(getPipeline().map((t) => t.id)).toEqual(['extractFields', 'noop', 'organize']);
    });

    it('does not rewrite the pipeline once it matches', async () => {
      const { result, setTransformations, rerender } = setup();

      await settled(result);
      const writes = setTransformations.mock.calls.length;

      rerender({});
      rerender({});

      await waitFor(() => expect(setTransformations.mock.calls.length).toBe(writes));
    });

    it('rewrites organize when the displayed fields change', async () => {
      const { result, getPipeline, rerender } = setup();

      await settled(result);

      rerender({ displayedFields: ['service'] });

      await waitFor(() => expect(getPipeline().at(-1)?.options.includeByName).toEqual({ service: true }));
    });
  });

  describe('displayed fields', () => {
    it('returns default fields', async () => {
      const { result } = setup();

      await settled(result);

      expect(result.current.frame.fields.map((f) => f.name)).toEqual([
        LOGS_DATAPLANE_TIMESTAMP_NAME,
        'level',
        LOGS_DATAPLANE_BODY_NAME,
      ]);
    });

    it('returns specified fields', async () => {
      const { result } = setup({ options: { displayedFields: ['service', 'level'] } });

      await settled(result);

      expect(result.current.frame.fields.map((f) => f.name)).toEqual(['service', 'level']);
    });

    // The field selector builds its list from this, so it has to keep every field the organize
    // transform dropped — including the `labels` column it enumerates labels from.
    it('exposes every available field before organize ran', async () => {
      const { result } = setup({ options: { displayedFields: ['service'] } });

      await settled(result);

      expect(result.current.availableFieldsFrame?.fields.map((f) => f.name)).toEqual(
        expect.arrayContaining([LOGS_DATAPLANE_TIMESTAMP_NAME, LOGS_DATAPLANE_BODY_NAME, 'labels', 'service', 'level'])
      );
    });
  });

  // Explore renders the panel directly and provides no pipeline. The transformations still have to
  // run or the panel shows a raw labels blob and every column at once.
  describe('without a host pipeline', () => {
    it('still transforms, using a pipeline held in component state', async () => {
      const { result, setTransformations } = setup({ withoutHostPipeline: true });

      await settled(result);

      expect(setTransformations).not.toHaveBeenCalled();
      expect(result.current.frame.fields.map((f) => f.name)).toEqual([
        LOGS_DATAPLANE_TIMESTAMP_NAME,
        'level',
        LOGS_DATAPLANE_BODY_NAME,
      ]);
    });
  });
});

describe('useDecorateFields', () => {
  describe('custom cell renderer', () => {
    it('only used on first column - enableLogDetails', async () => {
      const { result } = setup({ options: { enableLogDetails: true } });

      await settled(result);

      const fields = result.current.frame.fields;
      expect(fields).toHaveLength(3);
      expect(fields[0].config.custom.cellOptions.type).toBe(TableCellDisplayMode.Custom);
      expect(fields[1].config.custom.cellOptions.type).toBe(TableCellDisplayMode.Pill);
      expect(fields[2].config.custom.cellOptions).not.toBeDefined();
    });

    it('only used on first column - showCopyLogLink', async () => {
      const { result } = setup({ options: { showCopyLogLink: true }, supportsPermalink: true });

      await settled(result);

      const fields = result.current.frame.fields;
      expect(fields).toHaveLength(3);
      expect(fields[0].config.custom.cellOptions.type).toBe(TableCellDisplayMode.Custom);
      expect(fields[1].config.custom.cellOptions.type).toBe(TableCellDisplayMode.Pill);
      expect(fields[2].config.custom.cellOptions).not.toBeDefined();
    });

    it('not used if enableLogDetails is false and showCopyLogLink is not set', async () => {
      const { result } = setup({ options: { enableLogDetails: false } });

      await settled(result);

      expect(result.current.frame.fields[0].config.custom.cellOptions).not.toBeDefined();
    });

    it('log line body has no cellOptions when it is moved from the first position', async () => {
      const { result, rerender } = setup({
        options: {
          displayedFields: [LOG_LINE_BODY_FIELD_NAME, LOGS_DATAPLANE_TIMESTAMP_NAME, 'level'],
          enableLogDetails: true,
        },
      });

      await waitFor(() => expect(result.current.frame.fields[0]?.name).toBe(LOGS_DATAPLANE_BODY_NAME));
      expect(result.current.frame.fields[0].config.custom?.cellOptions).toBeDefined();

      rerender({
        displayedFields: [LOGS_DATAPLANE_TIMESTAMP_NAME, LOG_LINE_BODY_FIELD_NAME, 'level'],
        enableLogDetails: true,
      });

      await waitFor(() => expect(result.current.frame.fields[1]?.name).toBe(LOGS_DATAPLANE_BODY_NAME));
      expect(result.current.frame.fields[1].config.custom?.cellOptions).not.toBeDefined();
    });
  });

  // Panel field config defaults reach the fields through applyFieldOverrides rather than a manual
  // merge, now that field config is applied after the transformations.
  it('applies panel fieldConfig defaults', async () => {
    const { result } = setup();

    await settled(result);

    expect(result.current.frame.fields[0].config.custom.filterable).toBe(true);
  });

  describe('log level column enhancements', () => {
    it('applies default level mapping and pill cell mode for level field', async () => {
      const { result } = setup();

      await settled(result);

      const levelField = result.current.frame.fields.find((f) => f.name === 'level');
      expect(levelField).toBeDefined();
      expect(levelField?.config.custom?.cellOptions?.type).toBe(TableCellDisplayMode.Pill);
      expect(levelField?.config.custom?.width).toBe(DEFAULT_LOG_LEVEL_FIELD_WIDTH);

      const mappingOptions = levelField?.config.mappings?.[0]?.options;
      expect(mappingOptions).toBeDefined();
      expect(mappingOptions && 'critical' in mappingOptions ? mappingOptions['critical'] : undefined).toBeDefined();
    });
  });
});
