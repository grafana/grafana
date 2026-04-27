import { act, renderHook } from '@testing-library/react';

import { store } from '@grafana/data/utils';

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

jest.mock('@grafana/data/utils', () => ({
  ...jest.requireActual('@grafana/data/utils'),
  store: {
    get: jest.fn(),
    set: jest.fn(),
    getBool: jest.fn(),
  },
}));

const mockedStore = jest.mocked(store, { shallow: true });

describe('useSidebarSavedState(persistanceKey, subKey, defaultValue)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when persistanceKey is not passed', () => {
    test('returns the default value', () => {
      const { result } = renderHook(() => useSidebarSavedState(undefined, 'subKey1', 1));

      const [state] = result.current;
      expect(state).toBe(1);
    });
  });

  describe('if defaultValue is a boolean', () => {
    test('reads a boolean value from the store', () => {
      mockedStore.getBool.mockReturnValue(true);

      const [persistanceKey, subKey, defaultValue] = ['persistanceKey2', 'subKey2', false];
      const { result } = renderHook(() => useSidebarSavedState(persistanceKey, subKey, defaultValue));

      expect(mockedStore.getBool).toHaveBeenCalledWith(`grafana.ui.sidebar.${persistanceKey}.${subKey}`, defaultValue);

      const [state] = result.current;
      expect(state).toBe(true);
    });
  });

  describe('if defaultValue is a number', () => {
    test('converts the value read from the store to an integer', () => {
      mockedStore.get.mockReturnValue('7');

      const [persistanceKey, subKey, defaultValue] = ['persistanceKey3', 'subKey3', 3];
      const { result } = renderHook(() => useSidebarSavedState(persistanceKey, subKey, defaultValue));

      expect(mockedStore.get).toHaveBeenCalledWith(`grafana.ui.sidebar.${persistanceKey}.${subKey}`);

      const [state] = result.current;
      expect(state).toBe(7);
    });

    test('returns defaultValue when the conversion fails', () => {
      mockedStore.get.mockReturnValue('seven');

      const [persistanceKey, subKey, defaultValue] = ['persistanceKey4', 'subKey4', 4];
      const { result } = renderHook(() => useSidebarSavedState(persistanceKey, subKey, defaultValue));

      expect(mockedStore.get).toHaveBeenCalledWith(`grafana.ui.sidebar.${persistanceKey}.${subKey}`);

      const [state] = result.current;
      expect(state).toBe(4);
    });
  });

  describe('if defaultValue is neither a boolean nor a number', () => {
    test('returns the default value', () => {
      const [persistanceKey, subKey, defaultValue] = ['persistanceKey5', 'subKey5', { test: 'five' }];
      const { result } = renderHook(() => useSidebarSavedState(persistanceKey, subKey, defaultValue));

      expect(mockedStore.get).not.toHaveBeenCalled();

      const [state] = result.current;
      expect(state).toBe(defaultValue);
    });
  });

  describe('when persistanceKey or subKey changes across re-renders', () => {
    test('re-reads the value from the store using the new key', () => {
      mockedStore.get.mockImplementation((key: string) => {
        const storeValues: Record<string, string> = {
          'grafana.ui.sidebar.persistanceKey6.subKeyA': '10',
          'grafana.ui.sidebar.persistanceKey7.subKeyA': '20',
          'grafana.ui.sidebar.persistanceKey7.subKeyB': '30',
        };
        return storeValues[key];
      });

      const initialProps = { persistanceKey: 'persistanceKey6', subKey: 'subKeyA', defaultValue: 42 };

      const { result, rerender } = renderHook(
        (props) => useSidebarSavedState(props.persistanceKey, props.subKey, props.defaultValue),
        { initialProps }
      );

      expect(result.current[0]).toBe(10);

      rerender({ ...initialProps, persistanceKey: 'persistanceKey7' });

      expect(result.current[0]).toBe(20);

      rerender({ ...initialProps, persistanceKey: 'persistanceKey7', subKey: 'subKeyB' });

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

  describe('on mobile viewport', () => {
    let restore: () => void;

    beforeEach(() => {
      restore = mockMatchMedia(true);
    });

    afterEach(() => {
      restore();
    });

    test('forces isDocked to true regardless of defaultToDocked', () => {
      const { result } = renderHook(() => useSidebar({ defaultToDocked: false }));
      expect(result.current.isDocked).toBe(true);
    });

    test('keeps isDocked true even after onToggleDock is called', () => {
      const { result } = renderHook(() => useSidebar({ defaultToDocked: false }));

      expect(result.current.isDocked).toBe(true);

      act(() => result.current.onToggleDock());

      expect(result.current.isDocked).toBe(true);
    });

    test('includes pane width in outerWrapperProps when a pane is open', () => {
      const { result } = renderHook(() => useSidebar({ hasOpenPane: true }));

      const style = result.current.outerWrapperProps.style as Record<string, number>;
      const paneWidth = result.current.paneWidth;
      expect(style?.paddingRight).toBeGreaterThan(paneWidth);
    });
  });
});
