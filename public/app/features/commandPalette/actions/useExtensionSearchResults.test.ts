import { act, renderHook } from '@testing-library/react';

import {
  type PluginExtensionCommandPaletteSearchProvider,
  type PluginExtensionFunction,
  PluginExtensionTypes,
} from '@grafana/data';
import { type UsePluginFunctionsResult, setPluginFunctionsHook } from '@grafana/runtime';

import { useExtensionSearchResults } from './useExtensionSearchResults';

type Extension = PluginExtensionFunction<PluginExtensionCommandPaletteSearchProvider>;

function extension(pluginId: string, fn: PluginExtensionCommandPaletteSearchProvider): Extension {
  return {
    id: `${pluginId}/search`,
    type: PluginExtensionTypes.function,
    title: pluginId,
    description: '',
    pluginId,
    fn,
  };
}

// The runtime hook is generic over the function signature; the palette only requests search providers.
function register(functions: Extension[], isLoading = false) {
  const result = { functions: functions as Array<PluginExtensionFunction<never>>, isLoading };
  setPluginFunctionsHook(() => result satisfies UsePluginFunctionsResult<never>);
}

const answers =
  (title: string): PluginExtensionCommandPaletteSearchProvider =>
  async () => [{ id: title, title, path: `/${title}` }];

const advance = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));
const titles = (sections: Array<{ actions: Array<{ name: string }> }>) =>
  sections.flatMap((s) => s.actions.map((a) => a.name));

describe('useExtensionSearchResults', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not show the answer to an earlier query while a provider has not answered the current one', async () => {
    register([
      extension('a', ({ searchQuery }) =>
        searchQuery === 'zq' ? Promise.resolve([{ id: 'zq', title: 'for zq', path: '/zq' }]) : new Promise(() => {})
      ),
    ]);
    const { result, rerender } = renderHook(
      ({ searchQuery }) => useExtensionSearchResults({ searchQuery, show: true }),
      {
        initialProps: { searchQuery: 'zq' },
      }
    );
    await advance(250);
    expect(titles(result.current.extensionSearchSections)).toEqual(['for zq']);

    rerender({ searchQuery: 'zqx' });

    expect(result.current.extensionSearchSections).toEqual([]);
    expect(result.current.isFetchingExtensionSearch).toBe(true);
  });

  it('still delivers results when the runtime hook returns a new but equal functions array on every render', async () => {
    const a = extension('a', answers('from a'));
    // The runtime hook memoizes, but nothing in its contract guarantees the array identity stays stable.
    setPluginFunctionsHook(() => ({ functions: [a] as Array<PluginExtensionFunction<never>>, isLoading: false }));

    const { result } = renderHook(() => useExtensionSearchResults({ searchQuery: 'query', show: true }));
    await advance(250);

    expect(titles(result.current.extensionSearchSections)).toEqual(['from a']);
    expect(result.current.isFetchingExtensionSearch).toBe(false);
  });

  it('drops the section of a provider that is no longer registered', async () => {
    const a = extension('a', answers('from a'));
    const b = extension('b', answers('from b'));
    register([a, b]);
    const { result, rerender } = renderHook(() => useExtensionSearchResults({ searchQuery: 'query', show: true }));
    await advance(250);
    expect(titles(result.current.extensionSearchSections)).toEqual(['from a', 'from b']);

    register([b]);
    rerender();

    expect(titles(result.current.extensionSearchSections)).toEqual(['from b']);
  });

  it('reports fetching again when searching resumes with the same query', async () => {
    register([extension('a', answers('from a'))]);
    const { result, rerender } = renderHook(({ show }) => useExtensionSearchResults({ searchQuery: 'query', show }), {
      initialProps: { show: true },
    });
    await advance(250);
    expect(result.current.isFetchingExtensionSearch).toBe(false);

    rerender({ show: false });
    rerender({ show: true });

    expect(result.current.isFetchingExtensionSearch).toBe(true);
    expect(result.current.extensionSearchSections).toEqual([]);
  });

  it('reports fetching while the plugins that provide search are loading', () => {
    register([], true);

    const { result } = renderHook(() => useExtensionSearchResults({ searchQuery: 'query', show: true }));

    expect(result.current.isFetchingExtensionSearch).toBe(true);
  });

  it('reports nothing for a query shorter than two characters', () => {
    register([extension('a', answers('from a'))], true);

    const { result } = renderHook(() => useExtensionSearchResults({ searchQuery: ' a ', show: true }));

    expect(result.current).toEqual({ extensionSearchSections: [], isFetchingExtensionSearch: false });
  });
});
