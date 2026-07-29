import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { map, type Observable } from 'rxjs';

import {
  type DataFrame,
  EventBusSrv,
  FieldType,
  LoadingState,
  type PanelData,
  standardTransformersRegistry,
  toDataFrame,
  type TransformerRegistryItem,
} from '@grafana/data';
import { type DataTransformerConfig } from '@grafana/schema';

import { type PanelContext, PanelContextProvider } from './PanelContext';
import { useTransformedData } from './useTransformedData';

const excludeDropField: DataTransformerConfig[] = [{ id: 'dropFields', options: { exclude: ['drop'] } }];

/** Drops the named fields from every frame. Enough to prove the pipeline ran. */
const dropFieldsTransformer = {
  id: 'dropFields',
  name: 'Drop fields',
  operator: (options: { exclude: string[] }) => (source: Observable<DataFrame[]>) =>
    source.pipe(
      map((frames) =>
        frames.map((frame) => {
          const fields = frame.fields.filter((f) => !options.exclude.includes(f.name));
          return { ...frame, fields, length: frame.length };
        })
      )
    ),
};

// The registry can only be initialised once per module, so everything is registered up front.
beforeAll(() => {
  standardTransformersRegistry.setInit(
    () =>
      [
        {
          id: dropFieldsTransformer.id,
          name: dropFieldsTransformer.name,
          transformation: () => Promise.resolve(dropFieldsTransformer),
          editor: () => null,
        },
        {
          id: 'boom',
          name: 'Boom',
          transformation: () => Promise.reject(new Error('kaboom')),
          editor: () => null,
        },
      ] as unknown as TransformerRegistryItem[]
  );
});

function makeData(overrides: Partial<PanelData> = {}): PanelData {
  return {
    state: LoadingState.Done,
    series: [
      toDataFrame({
        refId: 'A',
        fields: [
          { name: 'keep', type: FieldType.number, values: [1, 2] },
          { name: 'drop', type: FieldType.number, values: [3, 4] },
        ],
      }),
    ],
    timeRange: { from: {}, to: {}, raw: { from: 'now-6h', to: 'now' } } as PanelData['timeRange'],
    ...overrides,
  };
}

interface SetupOptions {
  enabled?: boolean;
  transformations?: DataTransformerConfig[];
  source?: PanelData;
  applyFieldConfig?: jest.Mock;
  splitTrailing?: number;
}

function setup(input: PanelData, options: SetupOptions = {}) {
  const {
    enabled = true,
    transformations = [],
    source,
    applyFieldConfig = jest.fn((d: PanelData) => d),
    splitTrailing,
  } = options;

  const context: PanelContext = {
    eventsScope: 'test',
    eventBus: new EventBusSrv(),
    isAdHocTransformsEnabled: () => enabled,
    getTransformations: () => transformations,
    setTransformations: jest.fn(),
    // Undefined makes the hook fall back to the current props, which is what we want when the
    // test is not specifically exercising pre-field-config source data.
    getUntransformedData: () => source,
    applyFieldConfig,
  };

  const wrapper = ({ children }: { children: ReactNode }) => (
    <PanelContextProvider value={context}>{children}</PanelContextProvider>
  );

  const { result, rerender } = renderHook((props: PanelData) => useTransformedData(props, { splitTrailing }), {
    wrapper,
    initialProps: input,
  });

  return { result, rerender, applyFieldConfig };
}

describe('useTransformedData', () => {
  it('returns the input untouched when the panel does not own the pipeline', () => {
    const input = makeData();
    const { result } = setup(input, { enabled: false, transformations: excludeDropField });

    expect(result.current.data).toBe(input);
    expect(result.current.isTransforming).toBe(false);
  });

  it('returns the input untouched when the pipeline is empty', () => {
    const input = makeData();
    const { result } = setup(input, { transformations: [] });

    expect(result.current.data).toBe(input);
  });

  it('does not apply field config when inactive', () => {
    const input = makeData();
    const { applyFieldConfig } = setup(input, { enabled: false, transformations: excludeDropField });

    expect(applyFieldConfig).not.toHaveBeenCalled();
  });

  it('runs the pipeline and applies field config to the result', async () => {
    const input = makeData();
    const { result, applyFieldConfig } = setup(input, { transformations: excludeDropField });

    await waitFor(() => expect(result.current.isTransforming).toBe(false));

    expect(applyFieldConfig).toHaveBeenCalledTimes(1);
    expect(result.current.data.series).toHaveLength(1);
  });

  it('reports loading on the very first run rather than flashing untransformed frames', async () => {
    const input = makeData();
    const { result } = setup(input, { transformations: excludeDropField });

    expect(result.current.isTransforming).toBe(true);
    expect(result.current.data.state).toBe(LoadingState.Loading);
    // The frames the panel would flash are held back until the pipeline resolves.
    expect(result.current.data.series[0].fields).toHaveLength(2);

    // Let the pipeline settle so the state update lands inside the test.
    await waitFor(() => expect(result.current.isTransforming).toBe(false));
  });

  it('surfaces a transformation error', async () => {
    const input = makeData();
    const { result } = setup(input, { transformations: [{ id: 'boom', options: {} }] });

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.error?.message).toContain('Error transforming data');
  });

  it('does not re-run the pipeline for a metadata-only change on the input', async () => {
    const input = makeData({ state: LoadingState.Loading });
    const { result, rerender, applyFieldConfig } = setup(input, { transformations: excludeDropField });

    await waitFor(() => expect(applyFieldConfig).toHaveBeenCalledTimes(1));

    // Same frames, different loading state — the pipeline must not run again.
    rerender({ ...input, state: LoadingState.Done });

    await waitFor(() => expect(result.current.data.series).toHaveLength(1));
    expect(applyFieldConfig).toHaveBeenCalledTimes(1);
  });

  // getUntransformedData is called on every render, so if it hands back a fresh series array the
  // effect re-subscribes forever. This asserts we run the pipeline once for stable source data.
  it('runs the pipeline once when the source data identity is stable', async () => {
    const input = makeData();
    const source = makeData();
    const { result, rerender, applyFieldConfig } = setup(input, { transformations: excludeDropField, source });

    await waitFor(() => expect(result.current.isTransforming).toBe(false));

    rerender({ ...input });
    rerender({ ...input });

    await waitFor(() => expect(result.current.data.series).toHaveLength(1));
    expect(applyFieldConfig).toHaveBeenCalledTimes(1);
  });

  describe('splitTrailing', () => {
    const dropKeepThenDropOther: DataTransformerConfig[] = [
      { id: 'dropFields', options: { exclude: ['drop'] } },
      { id: 'dropFields', options: { exclude: ['keep'] } },
    ];

    it('is not computed unless asked for', async () => {
      const { result } = setup(makeData(), { transformations: dropKeepThenDropOther });

      await waitFor(() => expect(result.current.isTransforming).toBe(false));
      expect(result.current.dataBeforeTrailing).toBeUndefined();
    });

    // A column picker needs the fields that were available before the panel's own trailing
    // transformation selected a subset of them.
    it('returns the data as of before the trailing transformations', async () => {
      const { result } = setup(makeData(), { transformations: dropKeepThenDropOther, splitTrailing: 1 });

      await waitFor(() => expect(result.current.isTransforming).toBe(false));

      expect(result.current.data.series[0].fields.map((f) => f.name)).toEqual([]);
      expect(result.current.dataBeforeTrailing?.series[0].fields.map((f) => f.name)).toEqual(['keep']);
    });

    it('applies field config to both stages', async () => {
      const { result, applyFieldConfig } = setup(makeData(), {
        transformations: dropKeepThenDropOther,
        splitTrailing: 1,
      });

      await waitFor(() => expect(result.current.isTransforming).toBe(false));
      expect(applyFieldConfig).toHaveBeenCalledTimes(2);
    });

    it('treats a split larger than the pipeline as splitting off everything', async () => {
      const input = makeData();
      const { result } = setup(input, { transformations: excludeDropField, splitTrailing: 5 });

      await waitFor(() => expect(result.current.isTransforming).toBe(false));

      expect(result.current.dataBeforeTrailing?.series[0].fields.map((f) => f.name)).toEqual(['keep', 'drop']);
    });
  });

  it('keeps structureRev stable while the frame structure is unchanged', async () => {
    const input = makeData();
    const { result, rerender } = setup(input, { transformations: excludeDropField });

    await waitFor(() => expect(result.current.isTransforming).toBe(false));
    const first = result.current.data.structureRev;

    rerender({ ...input, state: LoadingState.Streaming });
    await waitFor(() => expect(result.current.data.state).toBe(LoadingState.Streaming));

    expect(result.current.data.structureRev).toBe(first);
  });
});
