import { renderHook } from '@testing-library/react';

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

  const createMockPlugin = (optionsWithQuickEdit: Array<{ path: string; name: string; quickEdit?: boolean }>) => {
    const plugin = getPanelPlugin({ id: 'stat' }).setPanelOptions((builder) => {
      for (const opt of optionsWithQuickEdit) {
        builder.addSelect({
          path: opt.path,
          name: opt.name,
          quickEdit: opt.quickEdit,
          settings: {
            options: [
              { value: 'option1', label: 'Option 1' },
              { value: 'option2', label: 'Option 2' },
            ],
          },
          defaultValue: 'option1',
        });
      }
    });

    return plugin;
  };

  it('should return null when plugin is undefined', () => {
    const panel = createMockPanel();

    const { result } = renderHook(() => useQuickEditOptions({ panel, plugin: undefined }));

    expect(result.current).toBeNull();
  });

  it('should return null when no options have quickEdit: true', () => {
    const panel = createMockPanel();
    const plugin = createMockPlugin([
      { path: 'textMode', name: 'Text mode', quickEdit: false },
      { path: 'colorMode', name: 'Color mode' },
    ]);

    const { result } = renderHook(() => useQuickEditOptions({ panel, plugin }));

    expect(result.current).toBeNull();
  });

  it('should return category with options that have quickEdit: true', () => {
    const panel = createMockPanel({ textMode: 'option1', colorMode: 'option2' });
    const plugin = createMockPlugin([
      { path: 'textMode', name: 'Text mode', quickEdit: true },
      { path: 'colorMode', name: 'Color mode', quickEdit: true },
      { path: 'graphMode', name: 'Graph mode', quickEdit: false },
    ]);

    const { result } = renderHook(() => useQuickEditOptions({ panel, plugin }));

    expect(result.current).not.toBeNull();
    expect(result.current?.props.title).toBe('Quick settings');
    expect(result.current?.items).toHaveLength(2);
    expect(result.current?.items[0].props.title).toBe('Text mode');
    expect(result.current?.items[1].props.title).toBe('Color mode');
  });

  it('should limit to maximum of 5 options with warning', () => {
    const panel = createMockPanel();
    const plugin = createMockPlugin([
      { path: 'opt1', name: 'Option 1', quickEdit: true },
      { path: 'opt2', name: 'Option 2', quickEdit: true },
      { path: 'opt3', name: 'Option 3', quickEdit: true },
      { path: 'opt4', name: 'Option 4', quickEdit: true },
      { path: 'opt5', name: 'Option 5', quickEdit: true },
      { path: 'opt6', name: 'Option 6', quickEdit: true },
      { path: 'opt7', name: 'Option 7', quickEdit: true },
    ]);
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { result } = renderHook(() => useQuickEditOptions({ panel, plugin }));

    expect(result.current).not.toBeNull();
    expect(result.current?.items).toHaveLength(5);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('has 7 options with quickEdit: true'));

    consoleSpy.mockRestore();
  });

  it('should allow exactly 5 options without warning', () => {
    const panel = createMockPanel();
    const plugin = createMockPlugin([
      { path: 'opt1', name: 'Option 1', quickEdit: true },
      { path: 'opt2', name: 'Option 2', quickEdit: true },
      { path: 'opt3', name: 'Option 3', quickEdit: true },
      { path: 'opt4', name: 'Option 4', quickEdit: true },
      { path: 'opt5', name: 'Option 5', quickEdit: true },
    ]);
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    const { result } = renderHook(() => useQuickEditOptions({ panel, plugin }));

    expect(result.current).not.toBeNull();
    expect(result.current?.items).toHaveLength(5);
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should preserve order of options as defined', () => {
    const panel = createMockPanel();
    const plugin = createMockPlugin([
      { path: 'colorMode', name: 'Color mode', quickEdit: true },
      { path: 'textMode', name: 'Text mode', quickEdit: true },
      { path: 'graphMode', name: 'Graph mode', quickEdit: true },
    ]);

    const { result } = renderHook(() => useQuickEditOptions({ panel, plugin }));

    expect(result.current).not.toBeNull();
    expect(result.current?.items[0].props.title).toBe('Color mode');
    expect(result.current?.items[1].props.title).toBe('Text mode');
    expect(result.current?.items[2].props.title).toBe('Graph mode');
  });

  it('should mix quickEdit: true and false options correctly', () => {
    const panel = createMockPanel();
    const plugin = createMockPlugin([
      { path: 'opt1', name: 'Option 1', quickEdit: true },
      { path: 'opt2', name: 'Option 2', quickEdit: false },
      { path: 'opt3', name: 'Option 3', quickEdit: true },
      { path: 'opt4', name: 'Option 4' }, // undefined = false
      { path: 'opt5', name: 'Option 5', quickEdit: true },
    ]);

    const { result } = renderHook(() => useQuickEditOptions({ panel, plugin }));

    expect(result.current).not.toBeNull();
    expect(result.current?.items).toHaveLength(3);
    expect(result.current?.items[0].props.title).toBe('Option 1');
    expect(result.current?.items[1].props.title).toBe('Option 3');
    expect(result.current?.items[2].props.title).toBe('Option 5');
  });
});
