import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { renderHook } from '@testing-library/react';
import { type PropsWithChildren } from 'react';

import {
  cacheFieldDisplayNames,
  DashboardCursorSync,
  type DataFrame,
  EventBusSrv,
  type FieldConfigSource,
  FieldType,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { getTestFeatureFlagClient, setTestFlags } from '@grafana/test-utils/unstable';
import { type PanelContext, PanelContextProvider } from '@grafana/ui';

import { useCacheFieldDisplayNames, useCellActions, useCommonTableProps, useTableSharedCrosshair } from './hooks';
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

beforeAll(() => {
  setTestFlags({ [FlagKeys.TableRefactorNested]: false });
});

afterAll(() => {
  setTestFlags({});
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

    // same reference -> memoized, no extra call
    rerender({ s: series });
    expect(cacheFieldDisplayNamesMock).toHaveBeenCalledTimes(1);

    // new reference -> recomputes
    rerender({ s: [makeFrame()] });
    expect(cacheFieldDisplayNamesMock).toHaveBeenCalledTimes(2);
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

describe('useCommonTableProps', () => {
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
      disableSanitizeHtml: false,
      nestedRefactorEnabled: false,
    });
  });

  it('reflects the nested-refactor feature flag', () => {
    setTestFlags({ [FlagKeys.TableRefactorNested]: true });
    const { result } = renderHook(() => useCommonTableProps(options, fieldConfig), { wrapper: FeatureFlagsProvider });

    expect(result.current.nestedRefactorEnabled).toBe(true);
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
