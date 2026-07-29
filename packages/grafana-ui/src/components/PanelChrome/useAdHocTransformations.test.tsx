import { renderHook } from '@testing-library/react';
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
  it('is disabled when the panel does not own the pipeline', () => {
    const { result } = setup({ enabled: false });

    expect(result.current.enabled).toBe(false);
    expect(result.current.transformations).toEqual([]);
  });

  it('is disabled when the host provides no transformation members at all', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PanelContextProvider value={{ eventsScope: 'test', eventBus: new EventBusSrv() }}>
        {children}
      </PanelContextProvider>
    );
    const { result } = renderHook(() => useAdHocTransformations(), { wrapper });

    expect(result.current.enabled).toBe(false);
    // Mutators must be safe no-ops rather than throwing.
    expect(() => result.current.add({ id: 'organize', options: {} })).not.toThrow();
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
