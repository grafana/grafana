import { act, renderHook } from '@testing-library/react';

import { store } from '@grafana/data';

import { useSidebar, useSidebarSavedState } from './useSidebar';

function mockMatchMedia(shouldMatchMobile: boolean) {
  const original = window.matchMedia;
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: shouldMatchMobile && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
  return () => {
    window.matchMedia = original;
  };
}

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  store: {
    get: jest.fn(),
    set: jest.fn(),
    getBool: jest.fn(),
  },
}));

const mockedStore = jest.mocked(store, { shallow: true });

describe('useSidebarSavedState(persistenceKey, subKey, defaultValue)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when persistenceKey is not passed', () => {
    test('returns the default value', () => {
      const { result } = renderHook(() => useSidebarSavedState(undefined, 'subKey1', 1));

      const [state] = result.current;
      expect(state).toBe(1);
    });
  });

  describe('if defaultValue is a boolean', () => {
    test('reads a boolean value from the store', () => {
      mockedStore.getBool.mockReturnValue(true);

      const [persistenceKey, subKey, defaultValue] = ['persistenceKey2', 'subKey2', false];
      const { result } = renderHook(() => useSidebarSavedState(persistenceKey, subKey, defaultValue));

      expect(mockedStore.getBool).toHaveBeenCalledWith(`grafana.ui.sidebar.${persistenceKey}.${subKey}`, defaultValue);

      const [state] = result.current;
      expect(state).toBe(true);
    });
  });

  describe('if defaultValue is a number', () => {
    test('converts the value read from the store to an integer', () => {
      mockedStore.get.mockReturnValue('7');

      const [persistenceKey, subKey, defaultValue] = ['persistenceKey3', 'subKey3', 3];
      const { result } = renderHook(() => useSidebarSavedState(persistenceKey, subKey, defaultValue));

      expect(mockedStore.get).toHaveBeenCalledWith(`grafana.ui.sidebar.${persistenceKey}.${subKey}`);

      const [state] = result.current;
      expect(state).toBe(7);
    });

    test('returns defaultValue when the conversion fails', () => {
      mockedStore.get.mockReturnValue('seven');

      const [persistenceKey, subKey, defaultValue] = ['persistenceKey4', 'subKey4', 4];
      const { result } = renderHook(() => useSidebarSavedState(persistenceKey, subKey, defaultValue));

      expect(mockedStore.get).toHaveBeenCalledWith(`grafana.ui.sidebar.${persistenceKey}.${subKey}`);

      const [state] = result.current;
      expect(state).toBe(4);
    });
  });

  describe('if defaultValue is neither a boolean nor a number', () => {
    test('returns the default value', () => {
      const [persistenceKey, subKey, defaultValue] = ['persistenceKey5', 'subKey5', { test: 'five' }];
      const { result } = renderHook(() => useSidebarSavedState(persistenceKey, subKey, defaultValue));

      expect(mockedStore.get).not.toHaveBeenCalled();

      const [state] = result.current;
      expect(state).toBe(defaultValue);
    });
  });

  describe('when persistenceKey or subKey changes across re-renders', () => {
    test('re-reads the value from the store using the new key', () => {
      mockedStore.get.mockImplementation((key: string) => {
        const storeValues: Record<string, string> = {
          'grafana.ui.sidebar.persistenceKey6.subKeyA': '10',
          'grafana.ui.sidebar.persistenceKey7.subKeyA': '20',
          'grafana.ui.sidebar.persistenceKey7.subKeyB': '30',
        };
        return storeValues[key];
      });

      const initialProps = { persistenceKey: 'persistenceKey6', subKey: 'subKeyA', defaultValue: 42 };

      const { result, rerender } = renderHook(
        (props) => useSidebarSavedState(props.persistenceKey, props.subKey, props.defaultValue),
        { initialProps }
      );

      expect(result.current[0]).toBe(10);

      rerender({ ...initialProps, persistenceKey: 'persistenceKey7' });

      expect(result.current[0]).toBe(20);

      rerender({ ...initialProps, persistenceKey: 'persistenceKey7', subKey: 'subKeyB' });

      expect(result.current[0]).toBe(30);
    });
  });
});

describe('useSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedStore.getBool.mockImplementation((_key: string, defaultValue: boolean) => defaultValue);
    mockedStore.get.mockReturnValue(undefined);
  });

  test('defaults isHidden to false', () => {
    const { result } = renderHook(() => useSidebar({}));
    expect(result.current.isHidden).toBe(false);
  });

  test('respects defaultIsHidden', () => {
    const { result } = renderHook(() => useSidebar({ defaultIsHidden: true }));
    expect(result.current.isHidden).toBe(true);
  });

  test('toggles isHidden via onToggleIsHidden', () => {
    const { result } = renderHook(() => useSidebar({ defaultIsHidden: true }));

    expect(result.current.isHidden).toBe(true);

    act(() => result.current.onToggleIsHidden());
    expect(result.current.isHidden).toBe(false);

    act(() => result.current.onToggleIsHidden());
    expect(result.current.isHidden).toBe(true);
  });

  test('returns empty outerWrapperProps when hidden', () => {
    const { result } = renderHook(() => useSidebar({ defaultIsHidden: true }));
    expect(result.current.outerWrapperProps).toEqual({});
  });

  test('returns outerWrapperProps with style when not hidden', () => {
    const { result } = renderHook(() => useSidebar({}));
    expect(result.current.outerWrapperProps).toHaveProperty('style');
  });

  test('setIsHidden sets the persisted hidden value', () => {
    const { result } = renderHook(() => useSidebar({ defaultIsHidden: false }));
    expect(result.current.isHidden).toBe(false);

    act(() => result.current.setIsHidden(true));
    expect(result.current.isHidden).toBe(true);

    // Idempotent — setting the same value again keeps it
    act(() => result.current.setIsHidden(true));
    expect(result.current.isHidden).toBe(true);

    act(() => result.current.setIsHidden(false));
    expect(result.current.isHidden).toBe(false);
  });

  describe('temporary-show on open pane', () => {
    test('shows the sidebar undocked when persisted hidden but a pane is open', () => {
      const { result, rerender } = renderHook(
        ({ hasOpenPane }: { hasOpenPane: boolean }) =>
          useSidebar({ defaultIsHidden: true, defaultToDocked: true, hasOpenPane }),
        { initialProps: { hasOpenPane: false } }
      );

      // No pane open — sidebar effectively hidden
      expect(result.current.isHidden).toBe(true);

      // Pane opens — sidebar effectively shown, forced undocked
      rerender({ hasOpenPane: true });
      expect(result.current.isHidden).toBe(false);
      expect(result.current.isDocked).toBe(false);
      // Dock toggle is hidden during temporary show
      expect(result.current.onToggleDock).toBeUndefined();

      // Pane closes — sidebar re-hides, persisted state was never flipped
      rerender({ hasOpenPane: false });
      expect(result.current.isHidden).toBe(true);
    });

    test('does not push body when temporarily shown', () => {
      const { result } = renderHook(() =>
        useSidebar({ defaultIsHidden: true, defaultToDocked: true, hasOpenPane: true })
      );

      // The body should not reserve space — the temp-shown sidebar floats over content
      expect(result.current.outerWrapperProps).toEqual({});
    });

    test('does not affect the not-hidden case', () => {
      const { result } = renderHook(() =>
        useSidebar({ defaultIsHidden: false, defaultToDocked: true, hasOpenPane: true })
      );

      expect(result.current.isHidden).toBe(false);
      expect(result.current.isDocked).toBe(true);
      expect(result.current.onToggleDock).toBeDefined();
    });
  });

  describe('hiddenPersistenceKey', () => {
    test('reads the hidden state from the override key, not persistenceKey', () => {
      mockedStore.getBool.mockImplementation((key: string, defaultValue: boolean) => {
        if (key === 'grafana.ui.sidebar.shared.hidden') {
          return true;
        }
        return defaultValue;
      });

      const { result } = renderHook(() => useSidebar({ persistenceKey: 'mode-a', hiddenPersistenceKey: 'shared' }));

      expect(result.current.isHidden).toBe(true);
    });

    test('writes the hidden state under the override key', () => {
      const { result } = renderHook(() => useSidebar({ persistenceKey: 'mode-a', hiddenPersistenceKey: 'shared' }));

      act(() => result.current.setIsHidden(true));

      expect(mockedStore.set).toHaveBeenCalledWith('grafana.ui.sidebar.shared.hidden', 'true');
    });

    test('different persistenceKey consumers share hidden state via hiddenPersistenceKey', () => {
      const storeState: Record<string, string> = {};
      mockedStore.getBool.mockImplementation(
        (key: string, defaultValue: boolean) => (storeState[key] ?? String(defaultValue)) === 'true'
      );
      mockedStore.set.mockImplementation((key, value) => {
        storeState[key] = String(value);
      });

      // First consumer hides the sidebar
      const { result: firstResult } = renderHook(() =>
        useSidebar({ persistenceKey: 'mode-a', hiddenPersistenceKey: 'shared' })
      );
      act(() => firstResult.current.setIsHidden(true));
      expect(firstResult.current.isHidden).toBe(true);

      // A second consumer with a different persistenceKey but the same hiddenPersistenceKey
      // should observe the shared hidden state.
      const { result: secondResult } = renderHook(() =>
        useSidebar({ persistenceKey: 'mode-b', hiddenPersistenceKey: 'shared' })
      );
      expect(secondResult.current.isHidden).toBe(true);
    });

    test('falls back to persistenceKey when hiddenPersistenceKey is not provided', () => {
      mockedStore.getBool.mockImplementation((key: string, defaultValue: boolean) => {
        if (key === 'grafana.ui.sidebar.fallback.hidden') {
          return true;
        }
        return defaultValue;
      });

      const { result } = renderHook(() => useSidebar({ persistenceKey: 'fallback' }));

      expect(result.current.isHidden).toBe(true);
    });
  });

  describe('on mobile viewport', () => {
    let restore: () => void;

    beforeEach(() => {
      restore = mockMatchMedia(true);
    });

    afterEach(() => {
      restore();
    });

    test('forces isDocked to false regardless of defaultToDocked', () => {
      const { result } = renderHook(() => useSidebar({ defaultToDocked: true }));
      expect(result.current.isDocked).toBe(false);
    });

    test('does not expose onToggleDock so the user cannot dock on mobile', () => {
      const { result } = renderHook(() => useSidebar({ defaultToDocked: true }));
      expect(result.current.onToggleDock).toBeUndefined();
    });

    test('does not push the body content when a pane is open (undocked overlay)', () => {
      const { result } = renderHook(() => useSidebar({ hasOpenPane: true, defaultToDocked: true }));

      const style = result.current.outerWrapperProps.style as Record<string, number>;
      const paneWidth = result.current.paneWidth;
      // Only the toolbar reserves space; the pane floats over the content as an overlay
      expect(style?.paddingRight).toBeLessThan(paneWidth);
    });
  });

  describe('minPaneWidth', () => {
    test('renders the open pane at minPaneWidth when the persisted width is smaller', () => {
      // Persisted width defaults to 240, which is below the pane's minimum
      const { result } = renderHook(() => useSidebar({ hasOpenPane: true, minPaneWidth: 700 }));
      expect(result.current.paneWidth).toBe(700);
    });

    test('does not resize the pane below minPaneWidth', () => {
      const { result } = renderHook(() => useSidebar({ hasOpenPane: true, minPaneWidth: 700 }));

      act(() => {
        result.current.onResize(-500);
      });

      expect(result.current.paneWidth).toBe(700);
    });

    test('allows resizing above minPaneWidth so there is a draggable range', () => {
      const { result } = renderHook(() => useSidebar({ hasOpenPane: true, minPaneWidth: 700 }));

      act(() => {
        result.current.onResize(150);
      });

      expect(result.current.paneWidth).toBe(850);
    });

    test('keeps the default 100px floor when no minPaneWidth is set', () => {
      const { result } = renderHook(() => useSidebar({ hasOpenPane: true }));

      act(() => {
        result.current.onResize(-1000);
      });

      expect(result.current.paneWidth).toBe(100);
    });
  });
});
