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

  describe('pending providers', () => {
    const slowProvider = (): [PluginExtensionCommandPaletteSearchProvider, () => void] => {
      let answer: () => void = () => {};
      const fn: PluginExtensionCommandPaletteSearchProvider = () =>
        new Promise((resolve) => {
          answer = () => resolve([{ id: 'r', title: 'Late result', path: '/r' }]);
        });
      return [fn, () => answer()];
    };
    const pendingTitles = (sections: Array<{ title: string; pending: boolean }>) =>
      sections.filter((s) => s.pending).map((s) => s.title);

    it('reports a provider as pending only once it has been running for 300 ms', async () => {
      const [fn] = slowProvider();
      register([extension('a', fn)]);
      const { result } = renderHook(() => useExtensionSearchResults({ searchQuery: 'query', show: true }));

      await advance(200 + 299);
      expect(pendingTitles(result.current.extensionSearchSections)).toEqual([]);

      await advance(1);
      expect(pendingTitles(result.current.extensionSearchSections)).toEqual(['a']);
    });

    it('replaces the pending section with the results when the provider answers', async () => {
      const [fn, answer] = slowProvider();
      register([extension('a', fn)]);
      const { result } = renderHook(() => useExtensionSearchResults({ searchQuery: 'query', show: true }));
      await advance(600);

      answer();
      await advance(0);

      expect(pendingTitles(result.current.extensionSearchSections)).toEqual([]);
      expect(titles(result.current.extensionSearchSections)).toEqual(['Late result']);
    });

    it('stops reporting a provider as pending when it times out', async () => {
      const [fn] = slowProvider();
      register([extension('a', fn)]);
      const { result } = renderHook(() => useExtensionSearchResults({ searchQuery: 'query', show: true }));
      await advance(600);

      await advance(3000);

      expect(pendingTitles(result.current.extensionSearchSections)).toEqual([]);
      expect(titles(result.current.extensionSearchSections)).toEqual([]);
    });

    it('does not report a provider as pending for the next query before it has been running for 300 ms', async () => {
      const [fn] = slowProvider();
      register([extension('a', fn)]);
      const { result, rerender } = renderHook(({ q }) => useExtensionSearchResults({ searchQuery: q, show: true }), {
        initialProps: { q: 'query' },
      });
      await advance(600);

      rerender({ q: 'query2' });

      expect(pendingTitles(result.current.extensionSearchSections)).toEqual([]);
    });
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
