import { act, renderHook } from '@testing-library/react';

import { EventBusSrv } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { VizPanel } from '@grafana/scenes';

import { useQuickEditOptions } from './useQuickEditOptions';

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
      onOptionsChange: jest.fn(),
    } as ReturnType<typeof panel.getPanelContext>);
    jest.spyOn(panel, 'onOptionsChange').mockImplementation(jest.fn());

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
    expect(result.current?.props.title).toBe('Quick settings');
    expect(result.current?.items).toHaveLength(2);
    expect(result.current?.items[0].props.title).toBe('Text mode');
    expect(result.current?.items[1].props.title).toBe('Color mode');
  });

  it('should warn and skip invalid paths', () => {
    const panel = createMockPanel();
    const plugin = createMockPlugin(['textMode', 'invalidPath']);
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { result } = renderHook(() => useQuickEditOptions({ panel, plugin }));

    expect(result.current).not.toBeNull();
    expect(result.current?.items).toHaveLength(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Quick edit path "invalidPath" not found'));

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

  it('should return null when all paths are invalid', () => {
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
});
