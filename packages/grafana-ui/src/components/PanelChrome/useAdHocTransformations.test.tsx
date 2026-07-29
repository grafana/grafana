import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';

import { EventBusSrv, type PanelPluginMeta, PluginContextProvider, PluginType } from '@grafana/data';
import { type DataTransformerConfig } from '@grafana/schema';

import { type PanelContext, PanelContextProvider } from './PanelContext';
import { useAdHocTransformations } from './useAdHocTransformations';

const pluginMeta: PanelPluginMeta = {
  id: 'table',
  name: 'Table',
  type: PluginType.panel,
  sort: 1,
  module: '',
  baseUrl: '',
  info: {
    author: { name: 'Grafana Labs' },
    description: '',
    links: [],
    logos: { large: '', small: '' },
    screenshots: [],
    updated: '',
    version: '',
  },
};

interface SetupOptions {
  enabled?: boolean;
  transformations?: DataTransformerConfig[];
}

function setup({ enabled = true, transformations = [] }: SetupOptions = {}) {
  let current = transformations;
  const setTransformations = jest.fn((next: DataTransformerConfig[]) => {
    current = next;
  });

  const context: PanelContext = {
    eventsScope: 'test',
    eventBus: new EventBusSrv(),
    isAdHocTransformsEnabled: () => enabled,
    getTransformations: () => current,
    setTransformations,
  };

  const wrapper = ({ children }: { children: ReactNode }) => (
    <PluginContextProvider meta={pluginMeta}>
      <PanelContextProvider value={context}>{children}</PanelContextProvider>
    </PluginContextProvider>
  );

  const { result, rerender } = renderHook(() => useAdHocTransformations(), { wrapper });

  return { result, rerender, setTransformations, getCurrent: () => current };
}

describe('useAdHocTransformations', () => {
  it('does not read the host pipeline when the panel does not own it', () => {
    const { result } = setup({ enabled: false, transformations: [{ id: 'editor', options: {} }] });

    expect(result.current.enabled).toBe(false);
    expect(result.current.transformations).toEqual([]);
  });

  describe('without a host pipeline', () => {
    function setupWithoutHost() {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <PluginContextProvider meta={pluginMeta}>
          <PanelContextProvider value={{ eventsScope: 'test', eventBus: new EventBusSrv() }}>
            {children}
          </PanelContextProvider>
        </PluginContextProvider>
      );

      return renderHook(() => useAdHocTransformations(), { wrapper });
    }

    it('reports itself disabled so persistence-implying UI can be hidden', () => {
      const { result } = setupWithoutHost();

      expect(result.current.enabled).toBe(false);
    });

    // Explore and a bare PanelRenderer provide no pipeline. Keeping one in component state is what
    // lets a panel run the same transformation code in every host.
    it('keeps the pipeline in component state instead of dropping writes', () => {
      const { result } = setupWithoutHost();

      act(() => result.current.add({ id: 'organize', options: { excludeByName: { a: true } } }));

      expect(result.current.transformations).toEqual([
        { id: 'organize', options: { excludeByName: { a: true } }, origin: { source: 'panel', pluginId: 'table' } },
      ]);
      expect(result.current.adHocTransformations).toHaveLength(1);
    });
  });

  it('exposes the whole pipeline', () => {
    const transformations: DataTransformerConfig[] = [
      { id: 'organize', options: {} },
      { id: 'limit', options: { limitField: 5 } },
    ];
    const { result } = setup({ transformations });

    expect(result.current.transformations).toEqual(transformations);
  });

  describe('adHocTransformations', () => {
    it('only includes panel-authored entries', () => {
      const { result } = setup({
        transformations: [
          { id: 'a', options: {} },
          { id: 'b', options: {}, origin: { source: 'editor' } },
          { id: 'c', options: {}, origin: { source: 'panel', pluginId: 'table' } },
        ],
      });

      expect(result.current.adHocTransformations.map((t) => t.id)).toEqual(['c']);
    });
  });

  describe('add', () => {
    it('stamps the origin with the plugin id from the plugin context', () => {
      const { result, setTransformations } = setup();

      result.current.add({ id: 'organize', options: { excludeByName: { a: true } } });

      expect(setTransformations).toHaveBeenCalledWith([
        { id: 'organize', options: { excludeByName: { a: true } }, origin: { source: 'panel', pluginId: 'table' } },
      ]);
    });

    it('appends after existing entries', () => {
      const { result, setTransformations } = setup({ transformations: [{ id: 'existing', options: {} }] });

      result.current.add({ id: 'organize', options: {} });

      expect(setTransformations.mock.calls[0][0].map((t: DataTransformerConfig) => t.id)).toEqual([
        'existing',
        'organize',
      ]);
    });

    // Locks in the append-never-merge decision: transformation options have no merge contract.
    it('adds a second entry for an id that already exists', () => {
      const { result, setTransformations } = setup({
        transformations: [{ id: 'organize', options: {}, origin: { source: 'panel' } }],
      });

      result.current.add({ id: 'organize', options: { excludeByName: { a: true } } });

      expect(setTransformations.mock.calls[0][0]).toHaveLength(2);
    });
  });

  describe('replaceAdHoc', () => {
    it('keeps editor entries in order and puts panel entries last', () => {
      const { result, setTransformations } = setup({
        transformations: [
          { id: 'editor-1', options: {}, origin: { source: 'editor' } },
          { id: 'old-panel', options: {}, origin: { source: 'panel' } },
          { id: 'editor-2', options: {} },
        ],
      });

      result.current.replaceAdHoc([{ id: 'new-panel', options: {} }]);

      expect(setTransformations.mock.calls[0][0].map((t: DataTransformerConfig) => t.id)).toEqual([
        'editor-1',
        'editor-2',
        'new-panel',
      ]);
    });

    it('stamps the replacements', () => {
      const { result, setTransformations } = setup();

      result.current.replaceAdHoc([{ id: 'organize', options: {} }]);

      expect(setTransformations.mock.calls[0][0][0].origin).toEqual({ source: 'panel', pluginId: 'table' });
    });

    // A panel whose first transformation prepares the data the user then transforms, and whose last
    // shapes the output, needs its entries on both sides of the editor's.
    it('straddles editor entries when given before and after', () => {
      const { result, setTransformations } = setup({
        transformations: [
          { id: 'old-panel', options: {}, origin: { source: 'panel' } },
          { id: 'editor', options: {} },
        ],
      });

      result.current.replaceAdHoc({
        before: [{ id: 'extractFields', options: {} }],
        after: [{ id: 'organize', options: {} }],
      });

      expect(setTransformations.mock.calls[0][0].map((t: DataTransformerConfig) => t.id)).toEqual([
        'extractFields',
        'editor',
        'organize',
      ]);
    });

    it('stamps both positions', () => {
      const { result, setTransformations } = setup();

      result.current.replaceAdHoc({ before: [{ id: 'extractFields', options: {} }], after: [] });

      expect(setTransformations.mock.calls[0][0][0].origin).toEqual({ source: 'panel', pluginId: 'table' });
    });
  });

  describe('clearAdHoc', () => {
    it('removes every panel entry by default', () => {
      const { result, setTransformations } = setup({
        transformations: [
          { id: 'editor', options: {} },
          { id: 'panel-a', options: {}, origin: { source: 'panel' } },
          { id: 'panel-b', options: {}, origin: { source: 'panel' } },
        ],
      });

      result.current.clearAdHoc();

      expect(setTransformations.mock.calls[0][0].map((t: DataTransformerConfig) => t.id)).toEqual(['editor']);
    });

    it('removes only matching panel entries when given a predicate', () => {
      const { result, setTransformations } = setup({
        transformations: [
          { id: 'panel-a', options: {}, origin: { source: 'panel' } },
          { id: 'panel-b', options: {}, origin: { source: 'panel' } },
        ],
      });

      result.current.clearAdHoc((t) => t.id === 'panel-a');

      expect(setTransformations.mock.calls[0][0].map((t: DataTransformerConfig) => t.id)).toEqual(['panel-b']);
    });
  });

  describe('set', () => {
    it('writes the pipeline verbatim without stamping', () => {
      const { result, setTransformations } = setup();
      const next: DataTransformerConfig[] = [{ id: 'organize', options: {} }];

      result.current.set(next);

      expect(setTransformations).toHaveBeenCalledWith(next);
    });
  });
});
