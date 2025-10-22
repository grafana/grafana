import { renderHook } from '@testing-library/react';

import { useAssistant } from '@grafana/assistant';

import { useShortcuts } from './HelpModal';

// Mock the assistant hook
jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn(),
}));

// Mock getModKey
jest.mock('app/core/utils/browser', () => ({
  getModKey: jest.fn(() => 'ctrl'),
}));

const mockUseAssistant = useAssistant as jest.MockedFunction<typeof useAssistant>;

describe('useShortcuts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return shortcuts without assistant shortcut when assistant is not available', () => {
    mockUseAssistant.mockReturnValue({
      isAvailable: false,
      toggleAssistant: jest.fn(),
    } as unknown as ReturnType<typeof useAssistant>);

    const { result } = renderHook(() => useShortcuts());

    expect(result.current).toHaveLength(4); // Global, Time range, Dashboard, Focused panel

    // Check that global shortcuts don't include assistant shortcut
    const globalCategory = result.current.find((category) => category.category.includes('Global'));
    expect(globalCategory).toBeDefined();

    const assistantShortcut = globalCategory!.shortcuts.find((shortcut) => shortcut.keys.includes('ctrl + .'));
    expect(assistantShortcut).toBeUndefined();
  });

  it('should return shortcuts with assistant shortcut when assistant is available', () => {
    mockUseAssistant.mockReturnValue({
      isAvailable: true,
      openAssistant: jest.fn(),
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });

    const { result } = renderHook(() => useShortcuts());

    expect(result.current).toHaveLength(4); // Global, Time range, Dashboard, Focused panel

    // Check that global shortcuts include assistant shortcut
    const globalCategory = result.current.find((category) => category.category.includes('Global'));
    expect(globalCategory).toBeDefined();

    const assistantShortcut = globalCategory!.shortcuts.find((shortcut) => shortcut.keys.includes('ctrl + .'));
    expect(assistantShortcut).toBeDefined();
    expect(assistantShortcut!.description).toContain('Assistant');
  });

  it('should include all expected shortcut categories', () => {
    mockUseAssistant.mockReturnValue({
      isAvailable: false,
      openAssistant: jest.fn(),
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });

    const { result } = renderHook(() => useShortcuts());

    const categories = result.current.map((category) => category.category);

    expect(categories).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Global'),
        expect.stringContaining('Time range'),
        expect.stringContaining('Dashboard'),
        expect.stringContaining('Focused panel'),
      ])
    );
  });

  it('should use the correct modKey in shortcuts', () => {
    mockUseAssistant.mockReturnValue({
      isAvailable: false,
      openAssistant: jest.fn(),
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });

    const { result } = renderHook(() => useShortcuts());

    // Find a shortcut that uses modKey (like save dashboard)
    const dashboardCategory = result.current.find((category) => category.category.includes('Dashboard'));
    const saveShortcut = dashboardCategory!.shortcuts.find((shortcut) =>
      shortcut.description.includes('Save dashboard')
    );

    expect(saveShortcut).toBeDefined();
    expect(saveShortcut!.keys[0]).toBe('ctrl + s');
  });

  it('should memoize results when dependencies do not change', () => {
    mockUseAssistant.mockReturnValue({
      isAvailable: false,
      openAssistant: jest.fn(),
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });

    const { result, rerender } = renderHook(() => useShortcuts());
    const firstResult = result.current;

    // Rerender without changing dependencies
    rerender();

    // Should return the same reference (memoized)
    expect(result.current).toBe(firstResult);
  });

  it('should update when assistant availability changes', () => {
    mockUseAssistant.mockReturnValue({
      isAvailable: false,
      openAssistant: jest.fn(),
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });

    const { result, rerender } = renderHook(() => useShortcuts());
    const firstResult = result.current;

    // Change assistant availability
    mockUseAssistant.mockReturnValue({
      isAvailable: true,
      openAssistant: jest.fn(),
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });
    rerender();

    // Should return a different reference (not memoized)
    expect(result.current).not.toBe(firstResult);

    // And should now include assistant shortcut
    const globalCategory = result.current.find((category) => category.category.includes('Global'));
    const assistantShortcut = globalCategory!.shortcuts.find((shortcut) => shortcut.keys.includes('ctrl + .'));
    expect(assistantShortcut).toBeDefined();
  });
});
