import { act, renderHook } from '@testing-library/react';
import React from 'react';

import { EventBusSrv } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { VizPanel } from '@grafana/scenes';

import { DashboardEditActionEvent } from './shared';
import { resetQuickEditWarnings, useQuickEditOptions } from './useQuickEditOptions';

describe('useQuickEditOptions', () => {
  const createMockPanel = (options: Record<string, unknown> = {}) => {
    const panel = new VizPanel({
      title: 'Test Panel',
      pluginId: 'stat',
      options,
    });

    jest.spyOn(panel, 'useState').mockReturnValue({ options } as ReturnType<typeof panel.useState>);
    jest.spyOn(panel, 'interpolate').mockImplementation((value) => value as string);
    jest.spyOn(panel, 'getPanelContext').mockReturnValue({
      eventBus: new EventBusSrv(),
      eventsScope: 'local',
      onOptionsChange: jest.fn(),
    } as ReturnType<typeof panel.getPanelContext>);
    jest.spyOn(panel, 'onOptionsChange').mockImplementation(jest.fn());
    jest.spyOn(panel, 'publishEvent').mockImplementation(jest.fn());

    return panel;
  };

  const createMockPlugin = (quickEditPaths?: string[]) => {
    const plugin = getPanelPlugin({ id: 'stat' }).setPanelOptions((builder) => {
      builder
        .addSelect({
          path: 'textMode',
          name: 'Text mode',
          settings: {
            options: [
              { value: 'auto', label: 'Auto' },
              { value: 'value', label: 'Value' },
            ],
          },
          defaultValue: 'auto',
        })
        .addSelect({
          path: 'colorMode',
          name: 'Color mode',
          settings: {
            options: [
              { value: 'none', label: 'None' },
              { value: 'value', label: 'Value' },
            ],
          },
          defaultValue: 'value',
        })
        .addBooleanSwitch({
          path: 'showGraph',
          name: 'Show graph',
          defaultValue: true,
        })
        .addBooleanSwitch({
          path: 'conditionalOption',
          name: 'Conditional option',
          defaultValue: false,
          showIf: (config) => config.showGraph === true,
        })
        .addBooleanSwitch({
          path: 'legend.showLegend',
          name: 'Visibility',
          category: ['Legend'],
          defaultValue: true,
        })
        .addSelect({
          path: 'tooltip.mode',
          name: 'Mode',
          category: ['Tooltip'],
          settings: {
            options: [
              { value: 'single', label: 'Single' },
              { value: 'all', label: 'All' },
            ],
          },
          defaultValue: 'single',
        });
    });

    if (quickEditPaths) {
      plugin.setQuickEditPaths(quickEditPaths);
    }

    return plugin;
  };

  it('should return null when plugin is undefined', () => {
    const panel = createMockPanel();

    const { result } = renderHook(() => useQuickEditOptions({ panel, plugin: undefined }));

    expect(result.current).toBeNull();
  });

  it('should return null when enabled is false', () => {
    const panel = createMockPanel({ textMode: 'auto' });
    const plugin = createMockPlugin(['textMode']);

    const { result } = renderHook(() => useQuickEditOptions({ panel, plugin, enabled: false }));

    expect(result.current).toBeNull();
  });

  it('should return null when plugin has no quick edit paths', () => {
    const panel = createMockPanel();
    const plugin = createMockPlugin();

    const { result } = renderHook(() => useQuickEditOptions({ panel, plugin }));

    expect(result.current).toBeNull();
  });

  it('should return null when quick edit paths array is empty', () => {
    const panel = createMockPanel();
    const plugin = createMockPlugin([]);

    const { result } = renderHook(() => useQuickEditOptions({ panel, plugin }));

    expect(result.current).toBeNull();
  });

  it('should return category with matching options', () => {
    const panel = createMockPanel({ textMode: 'value', colorMode: 'none' });
    const plugin = createMockPlugin(['textMode', 'colorMode']);

    const { result } = renderHook(() => useQuickEditOptions({ panel, plugin }));

    expect(result.current).not.toBeNull();
    expect(result.current?.props.title).toBe('Quick edit');
    expect(result.current?.items).toHaveLength(2);
    expect(result.current?.items[0].props.title).toBe('Text mode');
    expect(result.current?.items[1].props.title).toBe('Color mode');
  });

  it('should include category prefix for nested options', () => {
    const panel = createMockPanel({ legend: { showLegend: true }, tooltip: { mode: 'single' } });
    const plugin = createMockPlugin(['legend.showLegend', 'tooltip.mode']);

    const { result } = renderHook(() => useQuickEditOptions({ panel, plugin }));

    expect(result.current).not.toBeNull();
    expect(result.current?.items).toHaveLength(2);
    expect(result.current?.items[0].props.title).toBe('Legend Visibility');
    expect(result.current?.items[1].props.title).toBe('Tooltip Mode');
  });

  it('should warn and skip invalid paths', () => {
    resetQuickEditWarnings();
    const panel = createMockPanel();
    const plugin = createMockPlugin(['textMode', 'invalidPath']);
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { result } = renderHook(() => useQuickEditOptions({ panel, plugin }));

    expect(result.current).not.toBeNull();
    expect(result.current?.items).toHaveLength(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Quick edit path "invalidPath" not found'));

    consoleSpy.mockRestore();
  });

  it('should only warn once per invalid path to avoid console spam', () => {
    resetQuickEditWarnings();
    const panel = createMockPanel({ textMode: 'auto' });
    const plugin = createMockPlugin(['textMode', 'invalidPath']);
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { result, rerender } = renderHook(() => useQuickEditOptions({ panel, plugin }));

    expect(result.current).not.toBeNull();
    expect(consoleSpy).toHaveBeenCalledTimes(1);

    rerender();
    rerender();
    rerender();

    expect(consoleSpy).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });

  it('should respect showIf conditions', () => {
    const panel = createMockPanel({ showGraph: false });
    const plugin = createMockPlugin(['showGraph', 'conditionalOption']);

    const { result } = renderHook(() => useQuickEditOptions({ panel, plugin }));

    expect(result.current).not.toBeNull();
    expect(result.current?.items).toHaveLength(1);
    expect(result.current?.items[0].props.title).toBe('Show graph');
  });

  it('should show conditional option when condition is met', () => {
    const panel = createMockPanel({ showGraph: true });
    const plugin = createMockPlugin(['showGraph', 'conditionalOption']);

    const { result } = renderHook(() => useQuickEditOptions({ panel, plugin }));

    expect(result.current).not.toBeNull();
    expect(result.current?.items).toHaveLength(2);
  });

  it('should pass annotations array to showIf callback', () => {
    const panel = createMockPanel({ textMode: 'auto' });
    const showIfMock = jest.fn().mockReturnValue(true);

    const plugin = getPanelPlugin({ id: 'test' })
      .setPanelOptions((builder) => {
        builder.addBooleanSwitch({
          path: 'testOption',
          name: 'Test option',
          defaultValue: false,
          showIf: showIfMock,
        });
      })
      .setQuickEditPaths(['testOption']);

    renderHook(() => useQuickEditOptions({ panel, plugin }));

    expect(showIfMock).toHaveBeenCalledWith(expect.any(Object), expect.any(Array), expect.any(Array));
    const annotations = showIfMock.mock.calls[0][2];
    expect(Array.isArray(annotations)).toBe(true);
  });

  it('should return null when all paths are invalid', () => {
    resetQuickEditWarnings();
    const panel = createMockPanel();
    const plugin = createMockPlugin(['invalidPath1', 'invalidPath2']);
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { result } = renderHook(() => useQuickEditOptions({ panel, plugin }));

    expect(result.current).toBeNull();

    consoleSpy.mockRestore();
  });

  it('should preserve order of paths', () => {
    const panel = createMockPanel();
    const plugin = createMockPlugin(['colorMode', 'textMode', 'showGraph']);

    const { result } = renderHook(() => useQuickEditOptions({ panel, plugin }));

    expect(result.current).not.toBeNull();
    expect(result.current?.items[0].props.title).toBe('Color mode');
    expect(result.current?.items[1].props.title).toBe('Text mode');
    expect(result.current?.items[2].props.title).toBe('Show graph');
  });

  describe('undo/redo support', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should publish DashboardEditActionEvent when changing an option', () => {
      const panel = createMockPanel({ textMode: 'auto' });
      const plugin = createMockPlugin(['textMode']);

      const { result } = renderHook(() => useQuickEditOptions({ panel, plugin }));

      expect(result.current).not.toBeNull();
      const item = result.current!.items[0];

      const rendered = item.props.render(item) as React.ReactElement<{ onChange: (value: string) => void }>;
      act(() => {
        rendered.props.onChange('value');
      });

      expect(panel.publishEvent).toHaveBeenCalledTimes(1);
      expect(panel.publishEvent).toHaveBeenCalledWith(expect.any(DashboardEditActionEvent), true);
    });

    it('should apply new value when perform is called', () => {
      const panel = createMockPanel({ textMode: 'auto' });
      const plugin = createMockPlugin(['textMode']);

      const { result } = renderHook(() => useQuickEditOptions({ panel, plugin }));
      const item = result.current!.items[0];

      const rendered = item.props.render(item) as React.ReactElement<{ onChange: (value: string) => void }>;
      act(() => {
        rendered.props.onChange('value');
      });

      const event = (panel.publishEvent as jest.Mock).mock.calls[0][0] as DashboardEditActionEvent;
      event.payload.perform();

      expect(panel.onOptionsChange).toHaveBeenCalledWith({ textMode: 'value' });
    });

    it('should restore old value when undo is called', () => {
      const panel = createMockPanel({ textMode: 'auto' });
      const plugin = createMockPlugin(['textMode']);

      jest.spyOn(panel, 'state', 'get').mockReturnValue({
        options: { textMode: 'value' },
        pluginId: 'stat',
        title: 'Test Panel',
        fieldConfig: { defaults: {}, overrides: [] },
      } as unknown as typeof panel.state);

      const { result } = renderHook(() => useQuickEditOptions({ panel, plugin }));
      const item = result.current!.items[0];

      const rendered = item.props.render(item) as React.ReactElement<{ onChange: (value: string) => void }>;
      act(() => {
        rendered.props.onChange('value');
      });

      const event = (panel.publishEvent as jest.Mock).mock.calls[0][0] as DashboardEditActionEvent;
      event.payload.undo();

      expect(panel.onOptionsChange).toHaveBeenCalledWith({ textMode: 'auto' });
    });
  });
});
