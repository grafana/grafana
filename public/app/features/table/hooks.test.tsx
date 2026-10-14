import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { act, cleanup, renderHook } from '@testing-library/react';
import { type PropsWithChildren } from 'react';

import {
  cacheFieldDisplayNames,
  DashboardCursorSync,
  type DataFrame,
  type DataTransformerConfig,
  EventBusSrv,
  type FieldConfigSource,
  FieldType,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';
import { type PanelContext, PanelContextProvider } from '@grafana/ui';

import {
  useCacheFieldDisplayNames,
  useAdHocColumnState,
  useCellActions,
  useCommonTableProps,
  useTableRefreshNewFeatures,
  useTableSharedCrosshair,
} from './hooks';
import { getCellActions } from './utils';

jest.mock('@grafana/data', () => {
  const actual = jest.requireActual('@grafana/data');
  return { ...actual, cacheFieldDisplayNames: jest.fn(actual.cacheFieldDisplayNames) };
});

jest.mock('app/core/config', () => ({
  ...jest.requireActual('app/core/config'),
  getConfig: jest.fn(() => ({ disableSanitizeHtml: false })),
}));

jest.mock('./utils', () => ({
  ...jest.requireActual('./utils'),
  getCellActions: jest.fn(() => [{ title: 'action' }]),
}));

const cacheFieldDisplayNamesMock = jest.mocked(cacheFieldDisplayNames);
const getCellActionsMock = jest.mocked(getCellActions);

function makeFrame(overrides: Partial<DataFrame> = {}): DataFrame {
  return {
    length: 1,
    fields: [{ name: 'value', type: FieldType.number, config: {}, values: [1] }],
    ...overrides,
  };
}

function makeContext(overrides: Partial<PanelContext> = {}): PanelContext {
  return {
    eventsScope: 'global',
    eventBus: new EventBusSrv(),
    ...overrides,
  };
}

function FeatureFlagsProvider({ children }: PropsWithChildren) {
  return <OpenFeatureProvider client={getTestFeatureFlagClient()}>{children}</OpenFeatureProvider>;
}

function wrapperWith(context: PanelContext) {
  return ({ children }: PropsWithChildren) => (
    <FeatureFlagsProvider>
      <PanelContextProvider value={context}>{children}</PanelContextProvider>
    </FeatureFlagsProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useCacheFieldDisplayNames', () => {
  it('caches the display name onto each field', () => {
    const frame = makeFrame({
      fields: [{ name: 'raw', type: FieldType.number, config: { displayName: 'Nice name' }, values: [1] }],
    });

    renderHook(() => useCacheFieldDisplayNames([frame]));

    expect(frame.fields[0].state?.displayName).toBe('Nice name');
  });

  it('only re-runs when the series reference changes', () => {
    const series = [makeFrame()];
    const { rerender } = renderHook(({ s }) => useCacheFieldDisplayNames(s), { initialProps: { s: series } });

    expect(cacheFieldDisplayNamesMock).toHaveBeenCalledTimes(1);

    rerender({ s: series });
    expect(cacheFieldDisplayNamesMock).toHaveBeenCalledTimes(1);

    rerender({ s: [makeFrame()] });
    expect(cacheFieldDisplayNamesMock).toHaveBeenCalledTimes(2);
  });
});

describe('useAdHocColumnState', () => {
  function contextWithSource(sourceSeries: DataFrame[]): PanelContext {
    const transformations: readonly DataTransformerConfig[] = [];

    return makeContext({
      adHocTransformations: {
        get: () => transformations,
        set: jest.fn(),
        getSourceSeries: () => sourceSeries,
        subscribe: () => () => {},
      },
    });
  }

  it('recovers visibility even when the transformation dropped every output frame', () => {
    const source = [makeFrame({ refId: 'A' })];
    const context = contextWithSource(source);
    const transformations: DataTransformerConfig[] = [
      {
        id: 'organize',
        filter: { id: 'byRefId', options: 'A' },
        options: { excludeByName: { value: true } },
      },
    ];
    context.adHocTransformations!.get = () => transformations;

    renderHook(() => useAdHocColumnState([], 0, true), { wrapper: wrapperWith(context) });

    expect(context.adHocTransformations!.set).toHaveBeenCalledWith('grafana:table-view', []);
  });

  it('calculates the catalog without mutating the source fields', () => {
    const sourceFrame = makeFrame({
      fields: [{ name: 'raw', type: FieldType.number, config: { displayName: 'Nice name' }, values: [1] }],
    });

    const { result } = renderHook(() => useAdHocColumnState([sourceFrame], 0, true), {
      wrapper: wrapperWith(contextWithSource([sourceFrame])),
    });

    expect(result.current?.columnCatalog).toEqual(['Nice name']);
    expect(sourceFrame.fields[0].state).toBeUndefined();
  });

  it.each(['removed', 'reordered'])('matches the source frame when output frames are %s', (change) => {
    const sourceSeries = ['A', 'B'].map((refId) =>
      makeFrame({ refId, fields: [{ name: refId, type: FieldType.number, config: {}, values: [1] }] })
    );
    const frames = change === 'removed' ? [sourceSeries[1]] : [sourceSeries[1], sourceSeries[0]];
    const context = contextWithSource(sourceSeries);
    const { result } = renderHook(() => useAdHocColumnState(frames, 0, true), {
      wrapper: wrapperWith(context),
    });

    expect(result.current?.columnCatalog).toEqual(['B']);
    act(() => result.current?.onHiddenColumnsChange(new Set(['B'])));
    expect(context.adHocTransformations?.set).toHaveBeenCalledWith('grafana:table-view', [
      {
        id: 'organize',
        filter: { id: 'byRefId', options: 'B' },
        options: { indexByName: {}, excludeByName: { B: true }, renameByName: {} },
      },
    ]);
  });

  it('checks column support on the matching source frame', () => {
    const frames = [makeFrame({ refId: 'B' })];
    const sourceSeries = [makeFrame({ refId: 'A' }), makeFrame({ refId: 'B' })];
    const { result, rerender } = renderHook(() => useAdHocColumnState(frames, 0, true), {
      wrapper: wrapperWith(contextWithSource(sourceSeries)),
    });
    expect(result.current?.columnCatalog).toEqual(['value']);

    sourceSeries[1] = makeFrame({
      refId: 'B',
      fields: [{ name: 'nested', type: FieldType.nestedFrames, config: {}, values: [[]] }],
    });
    rerender();

    expect(result.current).toBeUndefined();
  });

  it('disables column controls when the source match becomes ambiguous', () => {
    const frames = [makeFrame({ refId: 'A' })];
    const sourceSeries = [...frames];
    const { result, rerender } = renderHook(() => useAdHocColumnState(frames, 0, true), {
      wrapper: wrapperWith(contextWithSource(sourceSeries)),
    });
    expect(result.current?.columnCatalog).toEqual(['value']);

    sourceSeries.push(makeFrame({ refId: 'A' }));
    rerender();

    expect(result.current).toBeUndefined();
  });

  it('does not enable column management for a nested table', () => {
    const sourceFrame = makeFrame({
      fields: [{ name: 'nested', type: FieldType.nestedFrames, config: {}, values: [[]] }],
    });

    const { result } = renderHook(() => useAdHocColumnState([sourceFrame], 0, true), {
      wrapper: wrapperWith(contextWithSource([sourceFrame])),
    });

    expect(result.current).toBeUndefined();
    expect(cacheFieldDisplayNamesMock).not.toHaveBeenCalled();
  });

  it('exposes the catalog when column management is enabled', () => {
    const frames = [makeFrame()];
    const { result, rerender } = renderHook(({ enabled }) => useAdHocColumnState(frames, 0, enabled), {
      initialProps: { enabled: false },
      wrapper: wrapperWith(contextWithSource(frames)),
    });

    expect(result.current).toBeUndefined();
    rerender({ enabled: true });
    expect(result.current?.columnCatalog).toEqual(['value']);
  });

  it('rejects duplicate display names and exposes a catalog after names become unique', () => {
    const sourceFrame = makeFrame({
      fields: [
        { name: 'first', type: FieldType.number, config: { displayName: 'Duplicate' }, values: [1] },
        { name: 'second', type: FieldType.number, config: { displayName: 'Duplicate' }, values: [2] },
      ],
    });
    const sourceSeries = [sourceFrame];
    const context = contextWithSource(sourceSeries);
    const { result, rerender } = renderHook(({ frames }) => useAdHocColumnState(frames, 0, true), {
      initialProps: { frames: sourceSeries },
      wrapper: wrapperWith(context),
    });

    expect(result.current).toBeUndefined();
    sourceSeries[0] = makeFrame({
      fields: sourceFrame.fields.map((field) => ({ ...field, config: { displayName: field.name } })),
    });
    rerender({ frames: [...sourceSeries] });
    expect(result.current?.columnCatalog).toEqual(['first', 'second']);
  });

  it('preserves existing source field state when resolving display names', () => {
    const state = { displayName: 'Cached name' };
    const frames = [
      makeFrame({
        fields: [{ name: 'raw', type: FieldType.number, config: {}, values: [1], state }],
      }),
    ];
    const { result } = renderHook(() => useAdHocColumnState(frames, 0, true), {
      wrapper: wrapperWith(contextWithSource(frames)),
    });

    expect(result.current?.columnCatalog).toEqual(['raw']);
    expect(frames[0].fields[0].state).toBe(state);
    expect(state).toEqual({ displayName: 'Cached name' });
  });

  it('writes frame-scoped column changes using the latest transformations without losing other transformations', () => {
    const frames = [makeFrame({ refId: 'A' }), makeFrame({ refId: 'B' })];
    const context = contextWithSource(frames);
    const api = context.adHocTransformations!;
    const { result } = renderHook(() => useAdHocColumnState(frames, 1, true), {
      wrapper: wrapperWith(context),
    });
    const otherFrame: DataTransformerConfig = {
      id: 'organize',
      filter: { id: 'byRefId', options: 'A' },
      options: { excludeByName: { value: true } },
    };
    const unrelated: DataTransformerConfig = { id: 'limit', options: { limitField: 3 } };
    let latest: readonly DataTransformerConfig[] = [otherFrame, unrelated];
    api.get = () => latest;
    const set = jest.spyOn(api, 'set').mockImplementation((_owner, next) => {
      latest = next;
    });

    act(() => result.current?.onHiddenColumnsChange(new Set(['value'])));
    expect(set).toHaveBeenLastCalledWith('grafana:table-view', [
      otherFrame,
      unrelated,
      {
        id: 'organize',
        filter: { id: 'byRefId', options: 'B' },
        options: { indexByName: {}, excludeByName: { value: true }, renameByName: {} },
      },
    ]);
  });

  it.each([undefined, 'A'])('disables ambiguous multi-frame column management for refId %s', (refId) => {
    const frames = [makeFrame({ refId }), makeFrame({ refId })];
    const context = contextWithSource(frames);
    const { result, rerender } = renderHook(({ frames }) => useAdHocColumnState(frames, 0, true), {
      initialProps: { frames },
      wrapper: wrapperWith(context),
    });
    expect(result.current).toBeUndefined();
    const nextFrames = [
      { ...frames[0], refId: 'A' },
      { ...frames[1], refId: 'B' },
    ];
    context.adHocTransformations!.getSourceSeries = () => nextFrames;
    rerender({ frames: nextFrames });
    expect(result.current?.columnCatalog).toEqual(['value']);
  });
});

describe('useCellActions', () => {
  const frame = makeFrame();
  const field = frame.fields[0];
  const replaceVariables = jest.fn((v: string) => v);

  it('returns an empty array when the user cannot execute actions', () => {
    const { result } = renderHook(() => useCellActions(replaceVariables), {
      wrapper: wrapperWith(makeContext({ canExecuteActions: () => false })),
    });

    expect(result.current(frame, field, 0)).toEqual([]);
    expect(getCellActionsMock).not.toHaveBeenCalled();
  });

  it('returns an empty array when canExecuteActions is not provided', () => {
    const { result } = renderHook(() => useCellActions(replaceVariables), {
      wrapper: wrapperWith(makeContext()),
    });

    expect(result.current(frame, field, 0)).toEqual([]);
    expect(getCellActionsMock).not.toHaveBeenCalled();
  });

  it('delegates to getCellActions when the user can execute actions', () => {
    const { result } = renderHook(() => useCellActions(replaceVariables), {
      wrapper: wrapperWith(makeContext({ canExecuteActions: () => true })),
    });

    expect(result.current(frame, field, 3)).toEqual([{ title: 'action' }]);
    expect(getCellActionsMock).toHaveBeenCalledWith(frame, field, 3, replaceVariables);
  });
});

describe('useTableSharedCrosshair', () => {
  afterEach(() => {
    config.featureToggles.tableSharedCrosshair = false;
  });

  it('is false when the feature toggle is off', () => {
    config.featureToggles.tableSharedCrosshair = false;
    const { result } = renderHook(() => useTableSharedCrosshair(), {
      wrapper: wrapperWith(makeContext({ sync: () => DashboardCursorSync.Crosshair })),
    });

    expect(result.current).toBe(false);
  });

  it('is false when the panel has no sync', () => {
    config.featureToggles.tableSharedCrosshair = true;
    const { result } = renderHook(() => useTableSharedCrosshair(), {
      wrapper: wrapperWith(makeContext()),
    });

    expect(result.current).toBe(false);
  });

  it('is false when cursor sync is Off', () => {
    config.featureToggles.tableSharedCrosshair = true;
    const { result } = renderHook(() => useTableSharedCrosshair(), {
      wrapper: wrapperWith(makeContext({ sync: () => DashboardCursorSync.Off })),
    });

    expect(result.current).toBe(false);
  });

  it('is true when the toggle is on and cursor sync is enabled', () => {
    config.featureToggles.tableSharedCrosshair = true;
    const { result } = renderHook(() => useTableSharedCrosshair(), {
      wrapper: wrapperWith(makeContext({ sync: () => DashboardCursorSync.Crosshair })),
    });

    expect(result.current).toBe(true);
  });
});

describe('useTableRefreshNewFeatures', () => {
  afterEach(() => {
    act(() => {
      setTestFlags({});
    });
  });

  it('is off with neither flag', () => {
    const { result } = renderHook(() => useTableRefreshNewFeatures(), { wrapper: FeatureFlagsProvider });

    expect(result.current).toBe(false);
  });

  it('is off without table.refresh', () => {
    setTestFlags({ [FlagKeys.TableRefreshNewFeatures]: true });
    const { result } = renderHook(() => useTableRefreshNewFeatures(), { wrapper: FeatureFlagsProvider });

    expect(result.current).toBe(false);
  });

  it('is off without table.refreshNewFeatures', () => {
    setTestFlags({ [FlagKeys.TableRefresh]: true });
    const { result } = renderHook(() => useTableRefreshNewFeatures(), { wrapper: FeatureFlagsProvider });

    expect(result.current).toBe(false);
  });

  it('is on with both feature flags', () => {
    setTestFlags({ [FlagKeys.TableRefresh]: true, [FlagKeys.TableRefreshNewFeatures]: true });
    const { result } = renderHook(() => useTableRefreshNewFeatures(), { wrapper: FeatureFlagsProvider });

    expect(result.current).toBe(true);
  });
});

describe('useCommonTableProps', () => {
  afterEach(() => {
    cleanup();
    setTestFlags({});
  });
  const fieldConfig: FieldConfigSource = { defaults: { noValue: 'n/a' }, overrides: [] };
  const options = {
    showHeader: false,
    showTypeIcons: true,
    sortBy: [{ displayName: 'time', desc: true }],
    frozenColumns: { left: 2 },
    enablePagination: true,
    cellHeight: undefined,
    maxRowHeight: 100,
    disableKeyboardEvents: true,
    hoverOverflow: false,
    frameIndex: 0,
  };

  it('maps panel options and field config to the matching TableNG props', () => {
    const { result } = renderHook(() => useCommonTableProps(options, fieldConfig), { wrapper: FeatureFlagsProvider });

    expect(result.current).toEqual({
      noHeader: true,
      noValue: 'n/a',
      showTypeIcons: true,
      resizable: true,
      sortBy: options.sortBy,
      frozenColumns: 2,
      enablePagination: true,
      cellHeight: undefined,
      maxRowHeight: 100,
      disableKeyboardEvents: true,
      hoverOverflow: false,
      disableSanitizeHtml: false,
      contentAwareWidthsEnabled: false,
      tableRefreshEnabled: false,
      jsonSyntaxHighlightingEnabled: false,
      zebraStriping: false,
    });
  });

  it('passes the table-refresh flag through', () => {
    setTestFlags({ [FlagKeys.TableRefresh]: true });
    const { result } = renderHook(() => useCommonTableProps(options, fieldConfig), { wrapper: FeatureFlagsProvider });

    expect(result.current.tableRefreshEnabled).toBe(true);
  });

  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])('gates JSON highlighting with table.refresh=%s and new features=%s', (refresh, newFeatures) => {
    setTestFlags({ [FlagKeys.TableRefresh]: refresh, [FlagKeys.TableRefreshNewFeatures]: newFeatures });
    const { result } = renderHook(() => useCommonTableProps(options, fieldConfig), {
      wrapper: FeatureFlagsProvider,
    });
    expect(result.current.jsonSyntaxHighlightingEnabled).toBe(newFeatures);
  });

  it('enables hover overflow when the option is undefined', () => {
    const { result } = renderHook(() => useCommonTableProps({ ...options, hoverOverflow: undefined }, fieldConfig), {
      wrapper: FeatureFlagsProvider,
    });

    expect(result.current.hoverOverflow).toBe(true);
  });

  // A dashboard can carry the zebra striping option in from an instance that has the toggle on, so
  // the option alone must not be enough to stripe.
  it('ignores the zebra striping option with the refresh-new-features flag off', () => {
    const { result } = renderHook(() => useCommonTableProps({ ...options, zebraStriping: true }, fieldConfig), {
      wrapper: FeatureFlagsProvider,
    });

    expect(result.current.zebraStriping).toBe(false);
  });

  it('honours the zebra striping option with the refresh-new-features flag on', () => {
    setTestFlags({ [FlagKeys.TableRefreshNewFeatures]: true });
    const { result } = renderHook(() => useCommonTableProps({ ...options, zebraStriping: true }, fieldConfig), {
      wrapper: FeatureFlagsProvider,
    });

    expect(result.current.zebraStriping).toBe(true);
  });

  it('passes pageSize through when the pagination-page-size flag is on', () => {
    setTestFlags({ [FlagKeys.TablePaginationPageSize]: true });
    const { result } = renderHook(() => useCommonTableProps({ ...options, pageSize: 25 }, fieldConfig), {
      wrapper: FeatureFlagsProvider,
    });

    expect(result.current.pageSize).toBe(25);
  });

  it('drops pageSize when the pagination-page-size flag is off', () => {
    setTestFlags({ [FlagKeys.TablePaginationPageSize]: false });
    const { result } = renderHook(() => useCommonTableProps({ ...options, pageSize: 25 }, fieldConfig), {
      wrapper: FeatureFlagsProvider,
    });

    expect(result.current.pageSize).toBeUndefined();
  });

  it('returns a stable reference when inputs do not change', () => {
    const { result, rerender } = renderHook(() => useCommonTableProps(options, fieldConfig), {
      wrapper: FeatureFlagsProvider,
    });
    const first = result.current;

    rerender();
    expect(result.current).toBe(first);
  });
});
