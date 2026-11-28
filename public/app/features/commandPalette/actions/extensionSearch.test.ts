import { ActionImpl } from 'kbar';

import {
  type PluginExtensionCommandPaletteSearchProvider,
  type PluginExtensionCommandPaletteSearchResult,
  type PluginExtensionFunction,
  PluginExtensionPoints,
  PluginExtensionTypes,
} from '@grafana/data';

import { SECTION_EXTENSION_SEARCH, SEARCH_RESULTS_PRIORITY } from '../values';

import { type ExtensionSearchSection, searchExtensionProviders } from './extensionSearch';

const mockLog = { error: jest.fn(), warning: jest.fn(), child: jest.fn() };
mockLog.child.mockReturnValue(mockLog);

jest.mock('app/features/plugins/extensions/logs/log', () => ({
  log: { child: (...args: unknown[]) => mockLog.child(...args) },
}));

function provider(
  pluginId: string,
  fn: PluginExtensionCommandPaletteSearchProvider,
  title = `${pluginId} results`
): PluginExtensionFunction<PluginExtensionCommandPaletteSearchProvider> {
  return {
    id: `${pluginId}/${title}`,
    type: PluginExtensionTypes.function,
    title,
    description: '',
    pluginId,
    fn,
  };
}

function results(count: number): PluginExtensionCommandPaletteSearchResult[] {
  return Array.from({ length: count }, (_, i) => ({ id: `r${i}`, title: `Result ${i}`, path: `/r${i}` }));
}

// Providers are third-party code, so tests hand them values the public types would reject.
function untyped(value: unknown): PluginExtensionCommandPaletteSearchProvider {
  // @ts-expect-error the provider contract is only enforced at runtime for third-party plugins
  return async () => value;
}

async function run(
  providers: Array<PluginExtensionFunction<PluginExtensionCommandPaletteSearchProvider>>,
  signal?: AbortSignal
) {
  const sections: ExtensionSearchSection[] = [];
  await searchExtensionProviders(providers, 'query', signal ?? new AbortController().signal, (s) => sections.push(s));
  return sections;
}

async function runOne(fn: PluginExtensionCommandPaletteSearchProvider) {
  const [section] = await run([provider('plugin-a', fn)]);
  return section;
}

describe('searchExtensionProviders', () => {
  beforeEach(() => {
    mockLog.error.mockClear();
    mockLog.warning.mockClear();
    mockLog.child.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('passes the query and an abort signal to the provider', async () => {
    const fn = jest.fn().mockResolvedValue([]);

    await run([provider('plugin-a', fn)]);

    expect(fn).toHaveBeenCalledWith({ searchQuery: 'query', signal: expect.any(AbortSignal) });
  });

  it('keeps only the first five results of a provider', async () => {
    const sections = await run([provider('plugin-a', async () => results(8))]);

    expect(sections[0].actions.map((a) => a.name)).toEqual([
      'Result 0',
      'Result 1',
      'Result 2',
      'Result 3',
      'Result 4',
    ]);
  });

  describe('result validation', () => {
    it.each([
      ['an empty id', { id: '', title: 'T', path: '/p' }],
      ['a numeric id', { id: 42, title: 'T', path: '/p' }],
      ['a missing title', { id: 'a', path: '/p' }],
      ['an empty title', { id: 'a', title: '', path: '/p' }],
      ['a non-string description', { id: 'a', title: 'T', path: '/p', description: 5 }],
      ['a non-string path', { id: 'a', title: 'T', path: 5, onSelect: () => {} }],
      ['a non-function onSelect', { id: 'a', title: 'T', onSelect: 'run()' }],
      ['neither path nor onSelect', { id: 'a', title: 'T' }],
      ['null', null],
      ['a string', 'a string'],
    ])('drops a result with %s', async (_, invalid) => {
      const valid = { id: 'ok', title: 'Valid', path: '/ok' };

      const section = await runOne(untyped([invalid, valid]));

      expect(section.actions.map((a) => a.id)).toEqual(['extension-search/plugin-a/ok']);
    });

    it('keeps a result that only has onSelect', async () => {
      const section = await runOne(async () => [{ id: 'a', title: 'T', onSelect: () => {} }]);

      expect(section.actions).toHaveLength(1);
    });

    it('keeps only the first of results sharing an id', async () => {
      const section = await runOne(async () => [
        { id: 'dup', title: 'First', path: '/first' },
        { id: 'dup', title: 'Second', path: '/second' },
        { id: 'other', title: 'Other', path: '/other' },
      ]);

      expect(section.actions.map((a) => a.name)).toEqual(['First', 'Other']);
    });

    it('counts only valid results towards the limit of five', async () => {
      const invalid = Array.from({ length: 4 }, () => ({ id: '', title: 'bad' }));

      const section = await runOne(untyped([...invalid, ...results(8)]));

      expect(section.actions).toHaveLength(5);
    });
  });

  describe('path validation', () => {
    it.each([
      'https://evil.example/phish',
      'http://evil.example',
      'javascript:alert(1)',
      '//evil.example/path',
      '/\t/evil.example',
      '/\\evil.example',
      'a/relative/path',
      '',
    ])('drops a result with path %p and warns', async (path) => {
      const valid = { id: 'ok', title: 'Valid', path: '/ok' };

      const section = await runOne(async () => [{ id: 'bad', title: 'Bad', path }, valid]);

      expect(section.actions.map((a) => a.id)).toEqual(['extension-search/plugin-a/ok']);
      expect(mockLog.warning).toHaveBeenCalledWith(expect.stringContaining('path'));
    });

    it('drops a result with an invalid path even when it has onSelect', async () => {
      const section = await runOne(async () => [
        { id: 'bad', title: 'Bad', path: 'https://evil.example', onSelect: () => {} },
      ]);

      expect(section.actions).toEqual([]);
    });

    it('adds the extension tracking params to a valid path', async () => {
      const section = await runOne(async () => [{ id: 'r1', title: 'T', path: '/d/abc?orgId=1' }]);

      const url = new URL(section.actions[0].url?.toString() ?? '', 'http://localhost');
      expect(url.pathname).toBe('/d/abc');
      expect(Object.fromEntries(url.searchParams)).toEqual({
        orgId: '1',
        uel_pid: 'plugin-a',
        uel_epid: PluginExtensionPoints.CommandPaletteSearch,
      });
    });
  });

  it('maps a result with onSelect to an action that performs it and does not navigate', async () => {
    const onSelect = jest.fn();

    const [section] = await run([
      provider(
        'plugin-a',
        async () => [{ id: 'r1', title: 'Title', description: 'Details', path: '/ignored', onSelect }],
        'Plugin A'
      ),
    ]);
    const [action] = section.actions;
    action.perform?.(new ActionImpl(action, { store: {} }));

    expect(action).toEqual({
      id: 'extension-search/plugin-a/r1',
      name: 'Title',
      subtitle: 'Details',
      section: 'Plugin A',
      sectionId: SECTION_EXTENSION_SEARCH,
      priority: SEARCH_RESULTS_PRIORITY,
      perform: expect.any(Function),
      url: expect.stringContaining('/ignored'),
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('maps a path-only result to a url action without perform', async () => {
    const section = await runOne(async () => [{ id: 'r1', title: 'Title', path: '/a/plugin-a/page' }]);

    expect(section.actions[0].url).toEqual(expect.stringContaining('/a/plugin-a/page'));
    expect(section.actions[0].perform).toBeUndefined();
  });

  it('reports the section title and id of the extension with its actions', async () => {
    const [section] = await run([provider('plugin-a', async () => results(1), 'Plugin A items')]);

    expect(section).toMatchObject({ id: 'plugin-a/Plugin A items', title: 'Plugin A items' });
    expect(section.actions).toHaveLength(1);
  });

  describe('onSelect', () => {
    async function selectAction(onSelect: () => void | Promise<void>) {
      const section = await runOne(async () => [{ id: 'r1', title: 'T', onSelect }]);
      const [action] = section.actions;
      return () => action.perform?.(new ActionImpl(action, { store: {} }));
    }

    it('does not throw when onSelect throws, so the palette still closes, and logs it with the plugin id', async () => {
      const perform = await selectAction(() => {
        throw new Error('select boom');
      });

      expect(perform).not.toThrow();
      expect(mockLog.child).toHaveBeenCalledWith(
        expect.objectContaining({ pluginId: 'plugin-a', extensionPointId: PluginExtensionPoints.CommandPaletteSearch })
      );
      expect(mockLog.error).toHaveBeenCalledWith(
        expect.stringContaining('select boom'),
        expect.objectContaining({ message: 'select boom' })
      );
    });

    it('catches and logs a rejected onSelect promise', async () => {
      const perform = await selectAction(() => Promise.reject(new Error('async boom')));

      perform();
      await Promise.resolve();

      expect(mockLog.error).toHaveBeenCalledWith(
        expect.stringContaining('async boom'),
        expect.objectContaining({ message: 'async boom' })
      );
    });
  });

  it('still returns results of other providers when one throws synchronously', async () => {
    const throwing: PluginExtensionCommandPaletteSearchProvider = () => {
      throw new Error('boom');
    };

    const sections = await run([provider('broken', throwing), provider('plugin-b', async () => results(1))]);

    expect(sections.find((s) => s.id.startsWith('plugin-b'))?.actions).toHaveLength(1);
    expect(sections.find((s) => s.id.startsWith('broken'))?.actions).toEqual([]);
    expect(mockLog.child).toHaveBeenCalledWith(expect.objectContaining({ pluginId: 'broken' }));
    expect(mockLog.error).toHaveBeenCalledWith(
      expect.stringContaining('boom'),
      expect.objectContaining({ message: 'boom' })
    );
  });

  it('still returns results of other providers when one rejects', async () => {
    const rejecting: PluginExtensionCommandPaletteSearchProvider = () => Promise.reject(new Error('nope'));

    const sections = await run([provider('broken', rejecting), provider('plugin-b', async () => results(2))]);

    expect(sections.find((s) => s.id.startsWith('plugin-b'))?.actions).toHaveLength(2);
    expect(mockLog.error).toHaveBeenCalledTimes(1);
  });

  it('logs a non-array return value', async () => {
    const section = await runOne(untyped({ items: [] }));

    expect(section.actions).toEqual([]);
    expect(mockLog.error).toHaveBeenCalledWith(expect.stringContaining('array'));
  });

  it('does not log an AbortError', async () => {
    const section = await runOne(() => Promise.reject(new DOMException('aborted', 'AbortError')));

    expect(section.actions).toEqual([]);
    expect(mockLog.error).not.toHaveBeenCalled();
  });

  it('discards a provider that does not settle within three seconds and aborts its signal', async () => {
    jest.useFakeTimers();
    let providerSignal: AbortSignal | undefined;
    const hanging: PluginExtensionCommandPaletteSearchProvider = ({ signal }) => {
      providerSignal = signal;
      return new Promise(() => {});
    };
    const sections: ExtensionSearchSection[] = [];

    const done = searchExtensionProviders(
      [provider('slow', hanging), provider('plugin-b', async () => results(1))],
      'query',
      new AbortController().signal,
      (s) => sections.push(s)
    );
    await jest.advanceTimersByTimeAsync(2999);
    expect(sections.map((s) => s.id)).toEqual(['plugin-b/plugin-b results']);
    await jest.advanceTimersByTimeAsync(1);
    await done;

    expect(sections.find((s) => s.id.startsWith('slow'))?.actions).toEqual([]);
    expect(providerSignal?.aborted).toBe(true);
    expect(mockLog.error).not.toHaveBeenCalled();
  });

  it('aborts the provider signal when the parent signal aborts', async () => {
    const parent = new AbortController();
    let providerSignal: AbortSignal | undefined;
    const hanging: PluginExtensionCommandPaletteSearchProvider = ({ signal }) => {
      providerSignal = signal;
      return new Promise(() => {});
    };

    const done = searchExtensionProviders([provider('slow', hanging)], 'query', parent.signal, () => {});
    parent.abort();
    await done;

    expect(providerSignal?.aborted).toBe(true);
    expect(mockLog.error).not.toHaveBeenCalled();
  });
});
