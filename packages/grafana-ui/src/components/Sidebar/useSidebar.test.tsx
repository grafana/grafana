import { renderHook } from '@testing-library/react';

import { store } from '@grafana/data';

import { useSidebarSavedState } from './useSidebar';

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
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
      const { result } = renderHook(() => useSidebarSavedState(undefined, undefined, 1));

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
